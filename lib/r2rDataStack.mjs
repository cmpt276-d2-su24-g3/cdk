import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CorsApiGateway } from './constructs/CorsApiGateway.mjs';
var table;

/**
 * Stack for managing region-to-region latency measurements and data access.
 * Provides infrastructure for storing and retrieving latency data between AWS regions.
 */
class R2RDataStack extends cdk.Stack {
    /**
     * Creates a new RegionLatencyStack.
     * @param {cdk.App} scope - The scope in which to define this construct.
     * @param {string} id - The scoped construct ID.
     * @param {cdk.StackProps} props - Stack properties.
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // TODO: table name should be dynamic; currently hardcoded for chatbot usage
       table = new dynamodb.Table(this, 'PingDB', {
            tableName: 'PingDB',
            partitionKey: { name: 'origin', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'destination#timestamp', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const fetchPing = new lambda.Function(this, "fetch-ping-function", {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "fetch-ping.handler",
            code: lambda.Code.fromAsset("resources/lambdas/"),
            timeout: cdk.Duration.seconds(30),

        });

        const api = new CorsApiGateway(this, 'r2r-data-api', {
            apiName: 'R2RDataAPI',
            description: 'This service fetches latency data from DynamoDB',
            allowMethods: ['GET', 'POST', 'OPTIONS'],
            allowOrigins: ['*']
        });

        api.addLambdaIntegration('fetch-ping', fetchPing, ['GET'], '200');

        fetchPing.addToRolePolicy(new PolicyStatement({
            actions: [
                'dynamodb:Scan', 
                'dynamodb:Query'
            ],
            resources: ['*'],
        }));

        new SSM.StringParameter(this, `r2r-api-ssm`, {
            parameterName: `R2RURL`,
            description: `The R2R URL`,
            stringValue: api.api.url,
        });
    }

    /**
     * returns reference to table for Lambdas to target
     * @returns {dynamodb.Table} The DynamoDB table instance.
     */
    getTableReference() {
        return table;
    }
}

export { R2RDataStack };
