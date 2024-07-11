import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
var table;

class R2RStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        table = new dynamodb.Table(this, 'PingDB', {
            tableName: 'R2R-Table',
            partitionKey: { name: 'source_origin', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production?
        });
    }

    // returns reference to table for Lambdas to target
    getTableReference() {
        return table;
    }
}

export { R2RStack };