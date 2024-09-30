import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
<<<<<<< HEAD
=======
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
//import * as dotenv from 'dotenv';
>>>>>>> main

export class R2CStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

<<<<<<< HEAD
    // Create the Lambda function
    const pingLambda = new lambda.Function(this, 'PingLambda', {
      functionName: `region-to-client-${props.env.region}`, // Function name includes region for uniqueness
      runtime: lambda.Runtime.NODEJS_20_X, // Lambda runtime
      code: lambda.Code.fromAsset('resources/lambdas/'), // Path to your Lambda code
      handler: 'region-to-client.handler',
    });
=======
 //REGION-TO-CLIENT
//dotenv.config();
>>>>>>> main

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

<<<<<<< HEAD
    // Expose the Lambda URL for the parent stack to collect
    this.lambdaUrl = functionUrl.url;
  }
}
=======
        // Region-to-Client:  API Gateway triggers the Lambda functions
        const api = new apigateway.LambdaRestApi(this, 'pingApi', {
            restApiName: 'UrlPingAPI',
            description: 'This service pings a given URL from various AWS regions.',
            handler: regionToClientFunction,
            proxy: false,
            defaultCorsPreflightOptions: {
              allowOrigins: ['*'],
              allowMethods: ["GET", "POST", "OPTIONS"]
            }
          });
      

        // Region-to-Client: Create a resource for region-to-client pings
        const urlPingResource = api.root.addResource('url-ping');
        

        // region-to-client permissions
        regionToClientFunction.addToRolePolicy(new PolicyStatement({
            actions: [
              'ec2:DescribeRegions',
            ],
            resources: [
              '*',  // Required for DescribeRegions
            ],
          }));

        const urlPingIntegration = new apigateway.LambdaIntegration(regionToClientFunction);
        urlPingResource.addMethod('POST', urlPingIntegration);

    }
};

export { R2CStack };
>>>>>>> main
