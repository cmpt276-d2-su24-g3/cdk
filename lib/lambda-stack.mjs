import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dotenv from 'dotenv';
dotenv.config();

class LambdaStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const { table } = props;

        //REGION-TO-REGION
        //region-to-region lambda
        const r2r = new lambda.Function(this, "regionFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-region.handler",
            code: lambda.Code.fromAsset("resources/lambdas"),
            environment: {
                THIS_REGION: cdk.Stack.of(this).region,
                TABLE_NAME: table.tableName,
            },
        });

        // region-to-region permissions
        r2r.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:PutItem',
                'ec2:DescribeRegions',
            ],
            resources: [
                'arn:aws:dynamodb:us-west-2:992382793912:table/R2R-Table',
                '*',  // Required for DescribeRegions
            ],
        }));

         // Region-to-Region: EventBridge set to invoke the Lambda 
         const schedulerRole = new Role(this, `scheduler-role-${cdk.Stack.of(this).region}`, {
            assumedBy: new ServicePrincipal('events.amazonaws.com'),
        });

        schedulerRole.addToPolicy(new PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [r2r.functionArn],
        }));

        // Region-to-Region: EventBridge set to  to trigger the Lambda function every hour
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });


        //REGION-TO-CLIENT

        // Region-to-Client:  API Gateway triggers the Lambda functions
        const api = new apigateway.RestApi(this, 'pingApi', {
            restApiName: 'Ping Service',
            description: 'This service pings a given URL from various AWS regions.',
            defaultCorsPreflightOptions: {
                allowOrigins: ['*'],
                allowMethods: ["GET", "POST", "OPTIONS"]
            }
        });

        // Region-to-Client: Create a resource for region-to-client pings
        const urlPingResource = api.root.addResource('url-ping');
        
        //region-to-client lambda
        const r2c = new lambda.Function(this, "urlFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-client.handler",
            code: lambda.Code.fromAsset("resources/lambdas"),
        })

        // region-to-client permissions
        r2c.addToRolePolicy(new PolicyStatement({
            actions: [
                'ec2:DescribeRegions',
            ],
            resources: [
                '*', 
            ],
        }));

        const urlPingIntegration = new apigateway.LambdaIntegration(r2c);
        urlPingResource.addMethod('GET', urlPingIntegration);


    }

}

export { LambdaStack };
