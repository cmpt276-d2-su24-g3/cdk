import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as SSM from 'aws-cdk-lib/aws-ssm';
//import * as dotenv from 'dotenv';


 //REGION-TO-CLIENT
//dotenv.config();


 //REGION-TO-CLIENT
//dotenv.config();

class R2CStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
   
    const pingLambda = new lambda.Function(this, 'PingLambda', {
      functionName: `region-to-client-${props.env.region}`,
      runtime: lambda.Runtime.NODEJS_20_X, 
      code: lambda.Code.fromAsset('resources/lambdas/'), 
      handler: 'region-to-client.handler',
      environment: {
        THIS_REGION: Stack.of(this).region,
      },
    });

    // Apply removal policy for development (destroy on stack deletion)
    pingLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Region-to-Client: API Gateway triggers the Lambda functions
    const api = new apigateway.LambdaRestApi(this, 'pingApi', {
      restApiName: 'UrlPingAPI',
      description: 'This service pings a given URL from various AWS regions.',
      handler: pingLambda,  
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
      resources: ['*'],  
    }));

    const urlPingIntegration = new apigateway.LambdaIntegration(pingLambda);

    urlPingResource.addMethod('POST', urlPingIntegration, {
      //  enables CORS on this endpoint
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Add CORS for 4XX responses in API Gateway
    api.addGatewayResponse('Default4xxGatewayResponse', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",  
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'*'",
      },
    });
    new SSM.StringParameter(this, `R2CURL-${props.env.region}`, {
      parameterName: `R2CURL-${props.env.region}`,
      description: `The R2C URL for ${props.env.region}`,
      stringValue: api.url,
    });

  }
};

export { R2CStack };

