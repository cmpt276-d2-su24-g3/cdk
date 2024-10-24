import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as dotenv from 'dotenv';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { CorsApiGateway } from './constructs/CorsApiGateway.mjs';
dotenv.config();

/**
 * AWS CDK Stack that creates a containerized chatbot infrastructure.
 * Includes VPC, ECS Fargate cluster, DynamoDB, and API Gateway.
 */
export class ChatbotStack extends cdk.Stack {
  /**
   * Creates a new ChatbotStack
   * @param {cdk.App} scope - Parent construct
   * @param {string} id - Stack identifier
   * @param {cdk.StackProps} props - Stack properties
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const envConfig = getEnvironmentConfig();

    // Create DynamoDB table for storing chat history
    const chatHistoryTable = new dynamodb.Table(this, 'chat-history-table', {
      tableName: 'chat_history', // follows the naming convention of the chatbot code
      partitionKey: { name: 'SessionId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, 'chatbot-vpc', {
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, 'chatbot-cluster', {
      vpc: vpc
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'chatbot-task-definition', {
            memoryLimitMiB: 1024,
            cpu: 512,
    });

    const logGroup = new logs.LogGroup(this, 'chatbot-log-group', {
        retention: logs.RetentionDays.ONE_WEEK,
    });

    const container = taskDefinition.addContainer('chatbot-container', {
        image: ecs.ContainerImage.fromAsset("resources/chatbot", {
            platform: "linux/amd64",  // Necessary when deploying from ARM64 machines
        }),
        memoryLimitMiB: 1024,
        logging: new ecs.AwsLogDriver({
            streamPrefix: 'chatbot',
            logGroup: logGroup,
        }),
        environment: envConfig,
      });

    // Open port for the API in the container (must match port that chatbot listens to)
    container.addPortMappings({
      containerPort: 80,
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'chatbot-fargate-service', {
      cluster: cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      publicLoadBalancer: true,
    });

    // Configure health check for ECS service
    fargateService.targetGroup.configureHealthCheck({
        port: '80',
        path: '/',
        timeout: cdk.Duration.seconds(60),
        startPeriod: cdk.Duration.seconds(120),   
        interval: cdk.Duration.seconds(90)        
    });

    // Create an API Gateway
    const api = new CorsApiGateway(this, 'chatbot-api-gateway', {
      apiName: 'ChatbotAPI',
      description: 'API Gateway to expose Chatbot container',
      allowMethods: ['OPTIONS', 'POST'],
    });

    // Integration of API Gateway with ECS Service via Load Balancer
    const ecsServiceUrl = `http://${fargateService.loadBalancer.loadBalancerDnsName}`;

    // Use the helper function to create routes
    api.addHttpIntegration('chat', ecsServiceUrl);
    api.addHttpIntegration('get-history', ecsServiceUrl);
    api.addHttpIntegration('delete-history', ecsServiceUrl, 'POST', '204');
    api.addHttpIntegration('available-services', ecsServiceUrl);

    new SSM.StringParameter(this, "chatbot-api-ssm", {
      parameterName: "ChatbotAPIUrl",
      description: "Chatbot API URL",
      stringValue: api.api.url,  // Note: access url through the api property
    });

  }
}

/**
 * Retrieves and validates required environment variables
 * @returns {Object} Environment configuration object
 * @throws {Error} If any required environment variable is missing
 */
const getEnvironmentConfig = () => {
  const requiredEnvVars = {
    CHATBOT_API_KEY: process.env.CHATBOT_API_KEY,
    AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  };

  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`${key} is not set in the environment`);
    }
  });

  return requiredEnvVars;
};
