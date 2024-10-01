import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
var table;

class PingDBStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

       table = new dynamodb.Table(this, 'PingDB', {
            tableName: 'PingDB',
            partitionKey: { name: 'origin', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'destination#timestamp', type: dynamodb.AttributeType.STRING },
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production?
        });
    
    }

    // returns reference to table for Lambdas to target
    getTableReference() {
        return table;
    }
}

export { PingDBStack };