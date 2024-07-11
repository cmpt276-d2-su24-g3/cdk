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

        const regionFunction = new lambda.Function(this, "regionFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset("resources/lambdas"),
            environment: {
                THIS_REGION: cdk.Stack.of(this).region,
                TABLE_NAME: table.tableName,
            },
        });

        // Grant cross-region permissions
        regionFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
            actions: [
                'dynamodb:PutItem',
            ],
            resources: [
                // can be hardcoded because pingdb is specifically named and singular
                'arn:aws:dynamodb:us-west-2:992382793912:table/R2R-table',
            ],
        }));

        // Create a role for EventBridge to invoke the Lambda function
        const schedulerRole = new Role(this, `scheduler-role-${cdk.Stack.of(this).region}`, {
            assumedBy: new ServicePrincipal('events.amazonaws.com'),
        });

        schedulerRole.addToPolicy(new PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [regionFunction.functionArn],
        }));

        // Create an EventBridge rule to trigger the Lambda function every hour
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(regionFunction)],
        });
    }
}

export { LambdaStack }