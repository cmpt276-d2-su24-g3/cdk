import { Stack } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

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

        /* TESTING PURPOSES */
        // create function urls so that the lambdas run manually
        const myFunctionUrl = r2r.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
        });
    }
}

export { LambdaStack }