import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
//import * as dotenv from 'dotenv';


 //REGION-TO-CLIENT
//dotenv.config();

class R2CStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

    // Create the Lambda function
    const pingLambda = new lambda.Function(this, 'PingLambda', {
      functionName: `region-to-client-${props.env.region}`, // Function name includes region for uniqueness
      runtime: lambda.Runtime.NODEJS_20_X, // Lambda runtime
      code: lambda.Code.fromAsset('resources/lambdas/'), // Path to your Lambda code
      handler: 'region-to-client.handler',
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
