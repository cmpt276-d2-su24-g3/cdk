import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';

export class ChatbotStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    // Create an ECS cluster in the VPC
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc: vpc
    });

    // Create a task definition with a single container
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
            memoryLimitMiB: 1024,  // Set the task-level memory (must be >= container memory)
            cpu: 512,              // Adjust the CPU if necessary (optional)
    });

    // Create a new log group in CloudWatch for your container logs
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,  // Retain logs for 1 week
    });

    const container = taskDefinition.addContainer('AppContainer', {
        image: ecs.ContainerImage.fromAsset("resources/chatbot", {
            platform: "linux/amd64",  // Specify the target architecture
            // might not be necessary on non-ARM64 machines
        }), // Path to the local Docker image folder
        memoryLimitMiB: 1024,
        // Enable logging to CloudWatch
        logging: new ecs.AwsLogDriver({
            streamPrefix: 'chatbot',  // Prefix for the log stream
            logGroup: logGroup,  // Use the log group created above
        })
      });

    // Open port for the API in the container
    container.addPortMappings({
      containerPort: 80,
    });

    // Define a Fargate Service to run the container
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster: cluster,           // Required: the ECS cluster
      taskDefinition: taskDefinition, // Required: the task definition with the container
      desiredCount: 1,           // The number of containers to run
      publicLoadBalancer: true,  // The API should be accessible publicly
    });

    fargateService.targetGroup.configureHealthCheck({
        port: '80',  // Should match the exposed container port
        path: '/',   // The path to check for health (e.g., your app's health check endpoint)
        timeout: cdk.Duration.seconds(60),
        startPeriod: cdk.Duration.seconds(120),
        interval: cdk.Duration.seconds(90)
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
        integrationResponses: [{ statusCode: "200" }]
      }
    });
    const chatResource = api.root.addResource('chat');
    chatResource.addMethod('POST', chatIntegration, {
      methodResponses: [{ statusCode: "200" }]
    });

    // Create /get-history route
    const getHistoryIntegration = new apigateway.HttpIntegration(`${ecsServiceUrl}/get-history`, {
      httpMethod: 'POST',
      options: {
        integrationResponses: [{ statusCode: "200" }]
      }
    });
    const getHistoryResource = api.root.addResource('get-history');
    getHistoryResource.addMethod('POST', getHistoryIntegration, {
      methodResponses: [{ statusCode: "200" }]
    });

    // Create /delete-history route
    const deleteHistoryIntegration = new apigateway.HttpIntegration(`${ecsServiceUrl}/delete-history`, {
      httpMethod: 'POST',
      options: {
        integrationResponses: [{ statusCode: "204" }]
      }
    });
    const deleteHistoryResource = api.root.addResource('delete-history');
    deleteHistoryResource.addMethod('POST', deleteHistoryIntegration, {
      methodResponses: [{ statusCode: "204" }]
    });

  }
}
