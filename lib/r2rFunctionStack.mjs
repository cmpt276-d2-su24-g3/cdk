import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';

/**
 * Stack deployed on each region to handle region-to-region data collection
 */
class R2RFunctionStack extends Stack {
    /**
     * Creates a new RegionR2RFunctionStack.
     * @param {cdk.App} scope - The scope in which to define this construct.
     * @param {string} id - The scoped construct ID.
     * @param {cdk.StackProps} props - Stack properties.
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        const { table } = props;

        const r2r = new lambda.Function(this, "regionFunction", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "region-to-region.handler",
            code: lambda.Code.fromAsset("resources/lambdas/"),
            timeout: cdk.Duration.seconds(15),
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
                `*`,  
                  
            ],
        }));

        // Schedule Lambda invocation every hour using EventBridge
        new Rule(this, `schedule-${cdk.Stack.of(this).region}`, {
            schedule: Schedule.rate(Duration.hours(1)),
            targets: [new LambdaFunction(r2r)],
        });
    }
}

export { LambdaStack };
