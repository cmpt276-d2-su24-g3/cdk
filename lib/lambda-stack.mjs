import { Stack } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

class LambdaStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Define your Lambda function (already done)
    const r2r = new lambda.Function(this, 'regionFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'region-to-region.handler',
      code: lambda.Code.fromAsset('resources/lambdas/'),
      environment: {
        THIS_REGION: cdk.Stack.of(this).region,
        TABLE_NAME: props.table.tableName,
      },
    });

    // Define the API Gateway and enable CORS
    const api = new apigateway.RestApi(this, 'pingApi', {
      restApiName: 'UrlPingAPI',
      description: 'This service pings a given URL from various AWS regions.',
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],  // Allow all origins, or replace with specific domain
        allowMethods: ['GET', 'POST', 'OPTIONS'],  // Allow these methods
        allowHeaders: ['Content-Type', 'Authorization'],  // Allow necessary headers
      },
    });

    // Add a resource and method with CORS support
    const urlPingResource = api.root.addResource('url-ping');
    const urlPingIntegration = new apigateway.LambdaIntegration(r2r);

    // Add the POST method with CORS
    urlPingResource.addMethod('POST', urlPingIntegration, {
      // This enables CORS on this endpoint
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  }
}

export { LambdaStack };
