import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';

class LambdaStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        // get ref to dynamodb
        const { table } = props;

        const r2r = new lambda.Function(this, "r2rFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-region.handler",
            code: lambda.Code.fromAsset("resources/lambdas"),
            environment: {
                THIS_REGION: cdk.Stack.of(this).region,
                TABLE_NAME: table.tableName,
            },
        });

        // Grant cross-region permissions
        r2r.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
            actions: [
                'dynamodb:PutItem',
            ],
            resources: [
                // can be hardcoded because pingdb is specifically named and singular
                'arn:aws:dynamodb:us-west-2:992382793912:table/PingDB',
            ],
        }));

        // Create a role for EventBridge to invoke the Lambda function
        const schedulerRole = new Role(this, `scheduler-role-${cdk.Stack.of(this).region}`, {
            assumedBy: new ServicePrincipal('events.amazonaws.com'),
        });

        schedulerRole.addToPolicy(new PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [r2r.functionArn],
        }));

        // Create an EventBridge rule to trigger the Lambda function every hour
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });
    }
}

export { LambdaStack }