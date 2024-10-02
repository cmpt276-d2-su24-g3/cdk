import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';  // Import API Gateway
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';     // Import PolicyStatement
import * as cdk from 'aws-cdk-lib';

class R2CStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the Lambda function
    const pingLambda = new lambda.Function(this, 'PingLambda', {
      functionName: `region-to-client-${props.env.region}`, // Function name includes region for uniqueness
      runtime: lambda.Runtime.NODEJS_20_X, // Lambda runtime
      code: lambda.Code.fromAsset('resources/lambdas/'), // Path to your Lambda code
      handler: 'region-to-client.handler',
      environment: {
        THIS_REGION: cdk.Stack.of(this).region,
      },
    });

    // Apply removal policy for development (destroy on stack deletion)
    pingLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Region-to-Client:  API Gateway triggers the Lambda functions
    const api = new apigateway.LambdaRestApi(this, 'pingApi', {
      restApiName: 'UrlPingAPI',
      description: 'This service pings a given URL from various AWS regions.',
      handler: pingLambda,  // Correct handler reference to pingLambda
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowMethods: ["GET", "POST", "OPTIONS"],
      },
    });

    // Region-to-Client: Create a resource for region-to-client pings
    const urlPingResource = api.root.addResource('url-ping');

    // region-to-client permissions
    pingLambda.addToRolePolicy(new PolicyStatement({
      actions: [
        'ec2:DescribeRegions',
      ],
      resources: ['*'],  // Required for DescribeRegions
    }));

    const urlPingIntegration = new apigateway.LambdaIntegration(pingLambda);
    urlPingResource.addMethod('POST', urlPingIntegration);

  }
};

export { R2CStack };
