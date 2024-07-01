import { Socket } from 'net'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// automatically tries to PUT in their own regions if not specified
const client = new DynamoDBClient({ region: 'us-west-2' });
const ddbDocClient = DynamoDBDocumentClient.from(client);

// find way to get regions programmatically
const REGIONS = [
    "ca-west-1",
    "ca-central-1",
    "us-west-1",
    "us-west-2",
    "us-east-1",
    "us-east-2",
]


var count;
export const handler = async () => {
    count = 0;
    console.log('Pinging All Regions')
    await Promise.all(REGIONS.map(region => pingRegion(region)));
    return {
        statusCode: 200,
        body: `${count} Pings Complete`,
    };
}
  
async function pingRegion(region) {
    const url = `dynamodb.${region}.amazonaws.com`
    console.log("Pinging " + region);
  
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
        await ddbDocClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
                timestamp: new Date().toISOString(),
                origin: process.env.THIS_REGION,
                destination: region,
                latency: latency,
            },
        }));
        console.log(region + " pinged successfully"); // console logs to cloudwatch
        count++;
    } catch (error) {
        console.log(region + " ping failed");
        console.log(error);
    }
}