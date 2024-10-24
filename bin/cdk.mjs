#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { R2RFunctionStack } from '../lib/r2rFunctionStack.mjs';
import { R2RDataStack } from '../lib/r2rDataStack.mjs';
import { ClientStack } from '../lib/clientStack.mjs';
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { R2CStack } from '../lib/r2cStack.mjs';
import { ChatbotStack } from '../lib/chatbotStack.mjs';

const app = new cdk.App();

// Central Deployments
const r2rStack = new R2RDataStack(app, 'r2r-data-stack', {
    env: {
        account: process.env.AWS_DEFAULT_ACCOUNT,
        region: process.env.AWS_DEFAULT_REGION,
    },
});

const chatbotStack = new ChatbotStack(app, 'chatbot-stack', {
    env: {
        account: process.env.AWS_DEFAULT_ACCOUNT,
        region: process.env.AWS_DEFAULT_REGION,   
    },
})

// Regional Deployments
const ec2Client = new EC2Client({ region: process.env.AWS_DEFAULT_REGION });
async function getRegions() {
    const command = new DescribeRegionsCommand({});
    const response = await ec2Client.send(command);
    return response.Regions.map(region => region.RegionName);
}

const regions = await getRegions();

const clientStack = new ClientStack(app, 'client-stack', {
    env: {
        account: process.env.AWS_DEFAULT_ACCOUNT,
        region: process.env.AWS_DEFAULT_REGION,   
    },
    regions: regions
})

async function deploy() {

    regions.forEach((region) => {
        const lambdaStackId = `r2r-function-stack-${region}`;
        new R2RFunctionStack(app, lambdaStackId, {
            table: r2rStack.getTableReference(),
            env: {
                account: process.env.AWS_DEFAULT_ACCOUNT,
                region: region,
            },
        });

        const r2cStackId = `r2c-stack-${region}`;
        new R2CStack(app, r2cStackId, {
            env: {
                account: process.env.AWS_DEFAULT_ACCOUNT,
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

