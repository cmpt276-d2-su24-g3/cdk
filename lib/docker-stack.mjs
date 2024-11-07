import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as dotenv from 'dotenv';
import * as SSM from 'aws-cdk-lib/aws-ssm';
dotenv.config();

/**
 * Chatbot stack creates a VPC with ECS cluster using Fargate,
 * deploys a container from /chatbot,
 * expose container's chatbot API endpoints with API Gateway,
 * and exports the API Gateway API URL with CloudFormation exports
 */
export class ChatbotStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Chat History Table
    const chatHistoryTable = new dynamodb.Table(this, 'ChatHistoryTable', {
      tableName: 'chat_history',
      partitionKey: { name: 'SessionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, 'ChatbotVpc', {
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, 'ChatbotCluster', {
      vpc: vpc
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
            memoryLimitMiB: 512,
            cpu: 256,
    });

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
        retention: logs.RetentionDays.ONE_WEEK,
    });

    const container = taskDefinition.addContainer('AppContainer', {
        image: ecs.ContainerImage.fromAsset("resources/chatbot", {
            platform: "linux/amd64",  // Necessary when deploying from ARM64 machines
        }),
        memoryLimitMiB: 512,
        logging: new ecs.AwsLogDriver({
            streamPrefix: 'chatbot',
            logGroup: logGroup,
        }),
        environment: {
          CHATBOT_API_KEY: process.env.CHATBOT_API_KEY || '',
          AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || '',
          BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || '',
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
      if (!process.env.CHATBOT_API_KEY ) {
        throw new Error('CHATBOT_API_KEY is not set in the environment');
      }
      if (!process.env.AWS_DEFAULT_REGION ) {
        throw new Error('AWS_DEFAULT_REGION is not set in the environment');
      }
      if (!process.env.BEDROCK_MODEL_ID ) {
        throw new Error('BEDROCK_MODEL_ID is not set in the environment');
      }
      if (!process.env.AWS_ACCESS_KEY_ID ) {
        throw new Error('BEDROCK_MODEL_ID is not set in the environment');
      }
      if (!process.env.AWS_SECRET_ACCESS_KEY ) {
        throw new Error('BEDROCK_MODEL_ID is not set in the environment');
      }

    // Open port for the API in the container (must match port that chatbot listens to)
    container.addPortMappings({
      containerPort: 80,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
    });

    fargateService.targetGroup.configureHealthCheck({
        port: '80',
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
      defaultCorsPreflightOptions: { // Minimal CORS configuration
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['OPTIONS', 'POST'], // Allowed HTTP methods
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
      },
    });

    // Integration of API Gateway with ECS Service via Load Balancer
    const ecsServiceUrl = `http://${fargateService.loadBalancer.loadBalancerDnsName}`;

    // Create a helper function for repeated integration patterns
    const createApiIntegration = (api, path, httpMethod, statusCode) => {
      const integration = new apigateway.HttpIntegration(`${ecsServiceUrl}/${path}`, {
        httpMethod,
        options: {
          integrationResponses: [{ 
            statusCode: statusCode.toString(),
            responseParameters: {
              'method.response.header.Access-Control-Allow-Origin': "'*'",
            }
          }]
        }
      });

      const resource = api.root.addResource(path);
      resource.addMethod(httpMethod, integration, {
        methodResponses: [{
          statusCode: statusCode.toString(),
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          }
        }]
      });

      return resource;
    };

    // Use the helper function to create routes
    createApiIntegration(api, 'chat', 'POST', 200);
    createApiIntegration(api, 'get-history', 'POST', 200);
    createApiIntegration(api, 'delete-history', 'POST', 204);
    createApiIntegration(api, 'available-services', 'POST', 200);

    new SSM.StringParameter(this, "Parameter", {
      parameterName: "ChatbotAPIUrl",
      description: "Description for your parameter",
      stringValue: api.url,
    });

  }
}
