#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack.mjs';
import { PingDBStack } from '../lib/r2r-stack.mjs';
import { S3Stack } from '../lib/s3-stack.mjs';
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { R2CStack } from '../lib/r2c-stack.mjs';
import { ChatbotStack } from '../lib/docker-stack.mjs';

const app = new cdk.App();

// Central Deployments (us-west-2, Oregon)
const r2rStack = new PingDBStack(app, 'PingDBMain', {
    env: {
        account: '992382793912',
        region: 'us-west-2',
    },
});

const chatbotStack = new ChatbotStack(app, 'ChatbotStack', {
    env: {
        account: '992382793912',
        region: 'us-west-2',   
    },
})

// Regional Deployments
const ec2Client = new EC2Client({ region: 'us-west-2' });
async function getRegions() {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
}

const regions = await getRegions();

const s3Stack = new S3Stack(app, 'S3Bucket', {
    env: {
        account: '992382793912',
        region: 'us-west-2',   
    },
    regions: regions
})

async function deploy() {

    regions.forEach((region) => {
        const lambdaStackId = `LambdaStack-${region}`;
        new LambdaStack(app, lambdaStackId, {
            table: r2rStack.getTableReference(),
            env: {
                account: '992382793912',
                region: region,
            },
        });

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

deploy().catch(err => {
    console.error('Error deploying CDK app:', err);
    process.exit(1);
});

