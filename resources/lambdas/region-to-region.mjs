import { Socket } from 'net';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";

const DB_REGION = 'us-west-2';
const TABLE_NAME = 'PingDB';
const THIS_REGION = process.env.THIS_REGION;
const TIME_TO_LIVE = 7 * 24 * 60 * 60; // 1 week in seconds

// Initialize clients outside the handler
const client = new DynamoDBClient({ region: DB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);
const ec2Client = new EC2Client({ region: DB_REGION });

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Credentials": true,
  "Content-Type": "application/json",
};

export const handler = async () => {
    console.log('Lambda function started');

    // Fetch regions to ping
    const regions = await getRegions();
    console.log('Regions to ping:', regions);

    const results = [];

    for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        try {
            const latency = await pingRegion(region);
            results.push({ region, latency });

            // Store result in DynamoDB
            await storeResult(region, latency);

        } catch (error) {
            console.error(`Error pinging region ${region}:`, error);
        }
    }

    // Return the results to the client with CORS headers
    return {
        statusCode: 200,
        headers, // Adding CORS headers
        body: JSON.stringify(results), 
    };
};

// Fetch available regions from EC2
async function getRegions() {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
}

// Ping a region and calculate latency
async function pingRegion(region) {
    const url = `dynamodb.${region}.amazonaws.com`;
    const client = new Socket();
    const start = process.hrtime.bigint();
    
    await new Promise((resolve, reject) => {
        client.connect(443, url, () => {
            client.end();
            resolve();
        });
        client.on('error', reject);
    });
    
    const end = process.hrtime.bigint();
    const latency = Number(end - start) / 1e6; // Convert to milliseconds

    console.log(`Ping to region ${region} took ${latency} ms`);

    return latency;
}

// Store ping result in DynamoDB
const storeResult = async (region, latency) => {
    const currentDate = new Date();
    const currentTimeInSeconds = Math.floor(currentDate.getTime() / 1000);
    const expireAt = currentTimeInSeconds + TIME_TO_LIVE;

    const params = {
        TableName: TABLE_NAME,
        Item: {
            timestamp: currentDate.toISOString(),
            origin: THIS_REGION,
            source_origin: THIS_REGION,
            destination: region,
            'destination#timestamp': `${region}#${currentDate.toISOString()}`,
            expireAt: expireAt,
            latency: latency,
        },
    };

    await ddbDocClient.send(new PutCommand(params));
};
