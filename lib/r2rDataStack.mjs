import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CorsApiGateway } from './constructs/CorsApiGateway.mjs';
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

        // Replace the existing API Gateway code with CorsApiGateway
        const api = new CorsApiGateway(this, 'fetchPingApi', {
            apiName: 'fetchPingApi',
            description: 'This service fetches latency data from DynamoDB',
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            allowOrigins: ['*']
        });

        // Add lambda integration using the construct's method
        api.addLambdaIntegration('fetch-ping', fetchPing, ['GET'], '200');

        // Add IAM permissions (unchanged)
        fetchPing.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:Scan', 
                'dynamodb:Query'
            ],
            resources: ['*'],
        }));

        // Store URL in SSM (update to use the new api reference)
        new SSM.StringParameter(this, `R2RURL`, {
            parameterName: `R2RURL`,
            description: `The R2R URL`,
            stringValue: api.api.url,
        });
    }

    // returns reference to table for Lambdas to target
    getTableReference() {
        return table;
    }
}

export { PingDBStack };
