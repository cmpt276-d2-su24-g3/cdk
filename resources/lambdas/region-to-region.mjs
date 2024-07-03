import { Socket } from 'net'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// find way to get regions programmatically
// once the lambda function is deployed, it loses ability to references the rest of this codebase
const REGIONS = [
  'ca-west-1',
  'ca-central-1',
  'us-west-1',
  'us-west-2',
  'us-east-1',
  'us-east-2',
];
const DB_REGION = 'us-west-2';
const TABLE_NAME = process.env.TABLE_NAME;
const THIS_REGION = process.env.THIS_REGION;
const TIME_TO_LIVE = 7 * 24 * 60 * 60; // 1 week in seconds

const client = new DynamoDBClient({ region: DB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler = async () => {
    for (const region of REGIONS) await pingRegion(region);
    return {
        statusCode: 200,
        body: `Pings Complete`,
    };
}
  
async function pingRegion(region) {
    const url = `dynamodb.${region}.amazonaws.com`
    const client = new Socket()
    const start = process.hrtime.bigint()
    await new Promise((resolve, reject) => {
        client.connect(443, url, () => {
            client.end()
            resolve()
        })
        client.on('error', reject)
    })
    const end = process.hrtime.bigint()
    const latency = Number(end - start) / 1e6

    try {
        storeResult(region, latency)
        console.log(region + " pinged successfully");
    } catch (error) {
        console.log(region + " ping failed");
        console.log(error);
    }
}

const storeResult = async (region, latency) => {
    const currentDate = new Date();
    const currentTimeInSeconds = Math.floor(currentDate.getTime()/1000);
    const expireAt = currentTimeInSeconds + TIME_TO_LIVE;
    const params = {
        TableName: TABLE_NAME,
        Item: {
            timestamp: currentDate.toISOString(),
            origin: THIS_REGION,
            destination: region,
            'destination#timestamp': `${region}#${currentDate.toISOString()}`,
            expireAt: expireAt,
            latency: latency,
        },
    };
  
    await ddbDocClient.send(new PutCommand(params));
};
  