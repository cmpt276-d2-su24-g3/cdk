import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

export class R2CStack extends Stack {
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

    // Create the function URL for the Lambda
    const functionUrl = pingLambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'], // Allow all origins for CORS
        allowedMethods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
      },
    });

    // Expose the Lambda URL for the parent stack to collect
    this.lambdaUrl = functionUrl.url;
  }
}
