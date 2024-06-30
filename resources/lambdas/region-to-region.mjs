import { Socket } from 'net'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
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

export const handler = async () => {
    console.log('Pinging All Regions')
    await Promise.all(REGIONS.map(region => pingRegion(region)));
    return {
        statusCode: 200,
        body: "All Pings Complete",
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
                timestamp: Date.now(),
                origin: process.env.AWS_DEFAULT_REGION,
                destination: region,
                latency: latency,
            },
        }));
        console.log(region + "pinged successfully"); // console logs to cloudwatch
    } catch (error) {
        console.log(region + "ping failed");
        console.log(error);
    }
}