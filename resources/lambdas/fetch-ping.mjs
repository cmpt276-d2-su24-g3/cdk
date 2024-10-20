import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const DB_REGION = 'us-west-2';
const TABLE_NAME = 'PingDB';

// Initialize clients outside the handler
const client = new DynamoDBClient({ region: DB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Credentials": true,
  "Content-Type": "application/json",
};

export const handler = async (event) => {
    console.log('Handling GET request to fetch latency data');
    return await fetchLatencyData();
};

// Query DynamoDB for existing latency data
const fetchLatencyData = async () => {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
        });
        const data = await ddbDocClient.send(command);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data.Items),
        };
    } catch (error) {
        console.error("Error querying DynamoDB:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: 'Error querying latency data' }),
        };
    }
};
