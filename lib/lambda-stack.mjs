import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';
//import * as dotenv from 'dotenv';
import { PingDBStack } from './r2r-stack.mjs';
//dotenv.config();

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

    
        r2r.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:Scan', 
                'dynamodb:Query', 
                'dynamodb:PutItem', 
                'ec2:DescribeRegions',
            ],
            resources: [
                `arn:aws:dynamodb:us-west-2:992382793912:table/PingDB`,  
                  
            ],
        }));

        // Schedule Lambda invocation every hour using EventBridge
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });

        //API Gateway to expose the Lambda function for querying DynamoDB
        const api = new apigateway.LambdaRestApi(this, 'RegionLatencyApi', {
            handler: r2r, 
            proxy: false,  
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'], 
                allowMethods: ["GET", "POST", "OPTIONS"],
              },
        });

        //GET endpoint for fetching latency from r2r-latency
        const latencyEndpoint = api.root.addResource('r2r-latency');  
        latencyEndpoint.addMethod('GET');  
    }
}

export { LambdaStack };
