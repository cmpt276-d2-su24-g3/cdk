import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
var table;

class PingDBStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

       table = new dynamodb.Table(this, 'PingDB', {
            tableName: 'PingDB',
            partitionKey: { name: 'origin', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'destination#timestamp', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production?
        });

        const fetchPing = new lambda.Function(this, "fetchPingFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "fetch-ping.handler",  // Your Lambda function handler
            code: lambda.Code.fromAsset("resources/lambdas/"),
            timeout: cdk.Duration.seconds(30),

        });

        const api = new apigateway.LambdaRestApi(this, 'fetchPingApi', {
            restApiName: 'fetchPingApi',
            description: 'This service fetches latency data from DynamoDB',
            handler: fetchPing,  // Correct handler reference to pingLambda
            proxy: false,
            defaultCorsPreflightOptions: {
              allowOrigins: ['*'], //change to client if cors issue
              allowMethods: ["GET", "POST", "OPTIONS"],
            },
        });
        const fetchPingResource = api.root.addResource('fetch-ping');

        fetchPing.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:Scan', 
                'dynamodb:Query'
            ],
            resources: ['*'],  // Required for DescribeRegions
        }));

        const fetchPingIntegration = new apigateway.LambdaIntegration(fetchPing);

        fetchPingResource.addMethod('GET', fetchPingIntegration, {
            // This enables CORS on this endpoint
            methodResponses: [{
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': true,
                },
            }],
        });

        // Add CORS for 4XX responses in API Gateway
        api.addGatewayResponse('Default4xxGatewayResponse', {
            type: apigateway.ResponseType.DEFAULT_4XX,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",  // Allow all origins
                'Access-Control-Allow-Headers': "'*'",
                'Access-Control-Allow-Methods': "'*'",
            },
        });

        new SSM.StringParameter(this, `R2RURL`, {
            parameterName: `R2RURL`,
            description: `The R2R URL`,
            stringValue: api.url,
        });
    }

    // returns reference to table for Lambdas to target
    getTableReference() {
        return table;
    }
}

export { PingDBStack };