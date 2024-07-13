import { Socket } from 'net';
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";

const ec2Client = new EC2Client();

export const handler = async (event) => {
    console.log('Lambda function started');
    
    const { url } = event.queryStringParameters;
    if (!url) {
        return {
            statusCode: 400,
            body: 'URL parameter is required',
        };
    }
    
    const regions = await getRegions();
    console.log('Regions to ping:', regions);
    
    const results = await Promise.all(regions.map(region => pingUrl(region, url)));
    
    console.log('Lambda function completed');
    return {
        statusCode: 200,
        body: JSON.stringify(results),
    };
};

async function getRegions() {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
}
  
async function pingUrl(region, url) {
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
    const latency = Number(end - start) / 1e6;

    console.log(`REGION: ${region}, URL: ${url}, ping: ${latency} ms`);

    return {
        region,
        url,
        latency
    };
}
