#!/usr/bin/env node

import * as cdk from 'aws-cdk-lib';
import { LambdaStack } from '../lib/lambda-stack.mjs';
import { PingDBStack } from '../lib/pingdb-stack.mjs';

// find way to get regions programmatically
const REGIONS = [
    "ca-west-1",
    "ca-central-1",
    "us-west-1",
    "us-west-2",
    "us-east-1",
    "us-east-2",
]

const app = new cdk.App();

// need reference to pass to LambdaStack
const pingDBStack = new PingDBStack(app, 'PingDBMain', {
    env: {
        account: '992382793912',
        region: 'us-west-2',
    },
});

REGIONS.forEach((region) => {
    const id = `LambdaStack-${region}`;
    new LambdaStack(app, id, {
        table: pingDBStack.getTableReference(),
        env: {
            account: '992382793912',
            region: region,
        },
    });
});