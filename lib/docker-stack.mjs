import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';

/**
 * Chatbot stack creates a VPC with ECS cluster using Fargate,
 * deploys a container from /chatbot,
 * expose container's chatbot API endpoints with API Gateway,
 * and exports the API Gateway API URL with CloudFormation exports
 */
export class ChatbotStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
            memoryLimitMiB: 1024,
            cpu: 512,
    });

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
    });

    const container = taskDefinition.addContainer('AppContainer', {
        image: ecs.ContainerImage.fromAsset("resources/chatbot", {
            platform: "linux/amd64",  // Necessary when deploying from ARM64 machines
        }),
        memoryLimitMiB: 1024,
        logging: new ecs.AwsLogDriver({
            streamPrefix: 'chatbot',
            logGroup: logGroup,
        })
      });

    // Open port for the API in the container (must match port that chatbot listens to)
    container.addPortMappings({
      containerPort: 80,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,           // The number of containers to run
      publicLoadBalancer: true,  // The API should be accessible publicly
    });

    fargateService.targetGroup.configureHealthCheck({
        port: '80',                               // Should match the exposed container port
        path: '/',                                // The path to check for health (e.g., your app's health check endpoint)
        timeout: cdk.Duration.seconds(60),        // how long before health check declares failure
        startPeriod: cdk.Duration.seconds(120),   // time before the first health check
        interval: cdk.Duration.seconds(90)        // time between each health check attempt
    });

    // Output the service URL
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName
    });

    // Create an API Gateway
    const api = new apigateway.RestApi(this, 'APIGateway', {
      restApiName: 'FargateContainerAPI',
      description: 'API Gateway to expose ECS container',
    });

    // Integration of API Gateway with ECS Service via Load Balancer
    const ecsServiceUrl = `http://${fargateService.loadBalancer.loadBalancerDnsName}`;

    // Create /chat route
    const chatIntegration = new apigateway.HttpIntegration(`${ecsServiceUrl}/chat`, {
      httpMethod: 'POST',
      options: {
        integrationResponses: [{ 
            statusCode: "200",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
            }
        }]
      }
    });
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', chatIntegration, {
        methodResponses: [{
            statusCode: "200",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
            }
        }]
    });

    // Create /get-history route
    const getHistoryIntegration = new apigateway.HttpIntegration(`${ecsServiceUrl}/get-history`, {
      httpMethod: 'POST',
      options: {
        integrationResponses: [{ 
            statusCode: "200",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
            }
        }]
      }
    });
    const getHistoryResource = api.root.addResource('get-history');
    getHistoryResource.addMethod('POST', getHistoryIntegration, {
        methodResponses: [{
            statusCode: "200",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
            }
        }]
    });

    // Create /delete-history route
    const deleteHistoryIntegration = new apigateway.HttpIntegration(`${ecsServiceUrl}/delete-history`, {
      httpMethod: 'POST',
      options: {
        integrationResponses: [{ 
            statusCode: "204",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': "'*'",
            }
        }]
      }
    });
    const deleteHistoryResource = api.root.addResource('delete-history');
    deleteHistoryResource.addMethod('POST', deleteHistoryIntegration, {
        methodResponses: [{
            statusCode: "204",
            responseParameters: {
                'method.response.header.Access-Control-Allow-Origin': true,
            }
        }]
    });

    // Output the API Gateway URL for the chatbot service
    new cdk.CfnOutput(this, 'ChatbotAPIUrl', {
        value: api.url,
        description: 'The URL of the Chatbot API',
        exportName: 'ChatbotAPIUrl',  // Use this name to import from other stacks
    });

  }
}
