import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as SSM from 'aws-cdk-lib/aws-ssm';
//import * as dotenv from 'dotenv';
import { CorsApiGateway } from './constructs/CorsApiGateway.mjs';


 //REGION-TO-CLIENT
//dotenv.config();


 //REGION-TO-CLIENT
//dotenv.config();

class R2CStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the Lambda function
    const r2cFunction = new lambda.Function(this, 'r2c-function', {
      functionName: `R2CFunction-${props.env.region}`,
      runtime: lambda.Runtime.NODEJS_20_X, // Lambda runtime
      code: lambda.Code.fromAsset('resources/lambdas/'), // Path to your Lambda code
      handler: 'region-to-client.handler',
      environment: {
        THIS_REGION: Stack.of(this).region,
      },
    });

    // Apply removal policy for development (destroy on stack deletion)
    r2cFunction.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Replace the API Gateway creation with CorsApiGateway
    const api = new CorsApiGateway(this, 'r2c-api', {
      apiName: `R2CAPI-${props.env.region}`,
      description: 'This service pings a given URL from this AWS region.',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowOrigins: ['*']
    });

    // Use the addLambdaIntegration method instead of manual resource creation
    api.addLambdaIntegration('r2c', r2cFunction);

    // region-to-client permissions
    r2cFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'ec2:DescribeRegions',
      ],
      resources: ['*'],  // Required for DescribeRegions
    }));

    new SSM.StringParameter(this, `R2CURL-${props.env.region}`, {
      parameterName: `R2CURL-${props.env.region}`,
      description: `The R2C URL for ${props.env.region}`,
      stringValue: api.api.url, // Note: need to access .api.url instead of just .url
    });

  }
};

export { R2CStack };
