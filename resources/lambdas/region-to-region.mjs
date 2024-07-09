/*
 * Name: Region-to-Region Latency
 * Description: Dynamically fetches the list of available regions and pings the DynamoDB endpoint in each region. The latency results are then stored in a DynamoDB table for analysis.
 * 
 * Modules:
 * - net: Used for creating network socket connections to measure latency.
 * - @aws-sdk/client-dynamodb: Provides classes and functions to interact with DynamoDB.
 * - @aws-sdk/lib-dynamodb: Offers higher-level abstractions for working with DynamoDB.
 * - @aws-sdk/client-ec2: Allows fetching information about AWS EC2 regions.
 * 
 * Environment Variables:
 * - TABLE_NAME: The name of the DynamoDB table where latency results will be stored.
 * - THIS_REGION: The AWS region where the Lambda function is deployed.
 * 
 */

import { Socket } from 'net'
import { DynamoDBClient, EndpointDiscoveryCommand } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";


const DB_REGION = 'us-west-2';
const TABLE_NAME = process.env.TABLE_NAME;
const THIS_REGION = process.env.THIS_REGION; 
const TIME_TO_LIVE = 7 * 24 * 60 * 60; // 1 week in seconds

const client = new DynamoDBClient({ region: DB_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);


//fetches AWS regions from SDK
async function getAWSRegions() {
    const ec2Client = new EC2Client({ region: DB_REGION });

    //allows adding filters for future use cases
    const input = { 
        Filters: [
          { 
            Name: "STRING_VALUE",
            Values: [ 
              "STRING_VALUE",
            ],
          },
        ],
        RegionNames: [ 
          "STRING_VALUE",
        ],
        DryRun: true || false,
        AllRegions: true || false,
      };
      
    const command = new DescribeRegionsCommand(input);
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);

}

export const handler = async () => {
    const regions = await getAWSRegions(); // fetches AWS regions dynamically
    for (const region of regions) await pingRegion(region);
    return {
        statusCode: 200,
        body: `Pings Complete`,
    };
};

  
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
        await storeResult(region, latency)
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
  