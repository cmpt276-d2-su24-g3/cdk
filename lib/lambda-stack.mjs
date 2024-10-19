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

        // Lambda function to handle region-to-region pings and fetch data from DynamoDB
        const r2r = new lambda.Function(this, "regionFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-region.handler",  // Your Lambda function handler
            code: lambda.Code.fromAsset("resources/lambdas/"),
            timeout: cdk.Duration.seconds(7),
            environment: {
                THIS_REGION: cdk.Stack.of(this).region,
                TABLE_NAME: table.tableName,
            },
        });

        // Grant Lambda permission to put items into DynamoDB, query table, and access EC2 regions
        r2r.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:Scan',  // Permission to scan the table
                'dynamodb:Query', // If you're querying specific items
                'dynamodb:PutItem',  // Permission to put latency items in the table
                'ec2:DescribeRegions',
            ],
            resources: [
                `arn:aws:dynamodb:us-west-2:992382793912:table/PingDB`,  // DynamoDB table in us-west-2
                  
            ],
        }));

        // Schedule Lambda invocation every hour using EventBridge
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });

        // **API Gateway to expose the Lambda function for querying DynamoDB**
        const api = new apigateway.LambdaRestApi(this, 'RegionLatencyApi', {
            handler: r2r,  // Attach the Lambda function
            proxy: false,  // Define specific routes
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'], //change to client if cors issue
                allowMethods: ["GET", "POST", "OPTIONS"],
              },
        });

        // Define a GET endpoint for fetching latency data from DynamoDB
        const latencyEndpoint = api.root.addResource('r2r-latency');  // The /latency endpoint
        latencyEndpoint.addMethod('GET');  // Allow GET requests to /latency
    }
}

export { LambdaStack };
