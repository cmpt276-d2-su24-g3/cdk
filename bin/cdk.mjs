#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack.mjs';
import { R2RStack } from '../lib/r2r-stack.mjs';

const app = new cdk.App();

const r2rStack = new R2RStack(app, 'R2RMain', {
    env: {
        account: '992382793912',
        region: 'us-west-2',   
    },
});

/*
// Define the AWS regions programmatically
const REGIONS = [
    "ca-west-1",
    "ca-central-1", 
    "us-west-1",
    "us-west-2",
    "us-east-1",
    "us-east-2",
];

// Iterate through each region and deploy LambdaStack
REGIONS.forEach((region) => {
    const id = `LambdaStack-${region}`;
    new LambdaStack(app, id, {
        table: r2rStack.getTableReference(),
        env: {
            account: '992382793912', 
            region: region,
        },
    });
});

*/

