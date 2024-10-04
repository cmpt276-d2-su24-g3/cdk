import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
dotenv.config();

class LambdaStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const { table } = props;

        // Lambda function to handle region-to-region pings
        const r2r = new lambda.Function(this, "regionFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-region.handler",
            code: lambda.Code.fromAsset("resources/lambdas/"),
            timeout: cdk.Duration.seconds(6),
            environment: {
                THIS_REGION: cdk.Stack.of(this).region,
                TABLE_NAME: table.tableName,
            },
        });

        // Grant Lambda permission to put items into DynamoDB and access EC2 regions
        r2r.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:PutItem',
                'ec2:DescribeRegions',
            ],
            resources: [
                table.tableArn, 
                '*', 
            ],
        }));

        // API Gateway for real-time ping requests
        const api = new apigateway.RestApi(this, 'PingAPI', {
            restApiName: 'Ping Service',
            description: 'Service to perform pings and return results.',
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'],  // CORS configuration
                allowMethods: ['GET', 'POST', 'OPTIONS'],  // Allow these methods
            },
        });

        // Lambda integration for the API Gateway
        const lambdaIntegration = new apigateway.LambdaIntegration(r2r, {
            proxy: true,
            integrationResponses: [{
                statusCode: "200",
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'",
                },
            }],
        });

        // Add a resource and method to the API
        api.root.addMethod('GET', lambdaIntegration, {
            methodResponses: [{
                statusCode: "200",
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': true,
                },
            }],
        });

        // Schedule Lambda invocation every hour using EventBridge
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });
    }
}

export { LambdaStack };
