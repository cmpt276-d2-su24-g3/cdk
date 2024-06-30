import { Stack, CfnOutput} from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

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

        table.grantReadWriteData(r2r);

        /* TESTING PURPOSES */
        // create function urls so that the lambdas run manually
        const myFunctionUrl = r2r.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
        });

        new CfnOutput(this, "myFunctionUrlOutput", {
            value: myFunctionUrl.url,
        })
    }
}

export { LambdaStack }