import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv';


 //REGION-TO-CLIENT
dotenv.config();

class R2CStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const regionToClientFunction = new lambda.Function(this, 'regionToClientHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-client.handler",
            code: lambda.Code.fromAsset("resources/lambdas/"),
          });

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