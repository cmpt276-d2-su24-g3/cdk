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

        // TODO: ONCE R2R is updated, make sure to export the URL dynamically
        new cdk.CfnOutput(this, 'R2RAPIUrl', {
            value: "https://1nuu606qd3.execute-api.us-west-2.amazonaws.com/default/LambdaStack-us-west-2-regionFunction0D786950-A7tCAv9V8Mr0",
            description: 'The URL of the R2R API',
            exportName: 'R2RAPIUrl',  // Use this name to import from other stacks
        });
    
    }

    // returns reference to table for Lambdas to target
    getTableReference() {
        return table;
    }
}

export { PingDBStack };