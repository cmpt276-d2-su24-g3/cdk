#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack.mjs';
import { PingDBStack } from '../lib/r2r-stack.mjs';
import { S3Stack } from '../lib/s3-stack.mjs';
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { R2CStack } from '../lib/r2c-stack.mjs';
import { ChatbotStack } from '../lib/docker-stack.mjs';
import { ChatbotClientStack } from '../lib/chatbot-client-stack.mjs';

const app = new cdk.App();

// Deploy PingDBStack in a specific region (us-west-2)
const r2rStack = new PingDBStack(app, 'PingDBMain', {
    env: {
        account: '992382793912',
        region: 'us-west-2',
    },
});

const chatbotStack = new ChatbotStack(app, 'Chatbot', {
    env: {
        account: '992382793912',
        region: 'us-west-2',   
    },
})

const s3Stack = new S3Stack(app, 'S3Bucket', {
    env: {
        account: '992382793912',
        region: 'us-west-2',   
    }
})

const chatbotClientStack = new ChatbotClientStack(app, 'ChatbotClientStack', {
    env: {
        account: '992382793912',
        region: 'us-west-2', 
    }
})

const r2cStack = new R2CStack(app, 'R2CMain', {
    env: {
        account: '992382793912',
        region: 'us-west-2', 
    },
});


// Create an EC2 client to describe regions
const ec2Client = new EC2Client({ region: 'us-west-2' });

// Define the AWS regions programmatically
async function getRegions() {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
}

async function deploy() {
    // Get the regions and deploy both LambdaStack and R2CStack to each
    const regions = await getRegions();




    regions.forEach((region) => {
        // Deploy LambdaStack in each region
        const lambdaStackId = `LambdaStack-${region}`;
        new LambdaStack(app, lambdaStackId, {
            table: r2rStack.getTableReference(), // Pass DynamoDB table reference if needed
            env: {
                account: '992382793912',
                region: region,
            },
        });

        // Deploy R2CStack in each region
        const r2cStackId = `R2CStack-${region}`;
        new R2CStack(app, r2cStackId, {
            env: {
                account: '992382793912',
                region: region,
            },
        });
    });

    app.synth();
}

// Run the deploy function
deploy().catch(err => {
    console.error('Error deploying CDK app:', err);
    process.exit(1);
});

