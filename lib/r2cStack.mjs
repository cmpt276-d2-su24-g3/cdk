import { Stack, RemovalPolicy } from 'aws-cdk-lib';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { CorsApiGateway } from './constructs/CorsApiGateway.mjs';

/**
 * AWS CDK Stack that creates a Region-to-Client (R2C) service infrastructure.
 * This stack deploys a Lambda function and API Gateway to ping URLs from specific AWS regions.
 */
class R2CStack extends Stack {
  /**
   * Constructs a new R2CStack
   * @param {Construct} scope - The scope in which to define this construct
   * @param {string} id - The scoped construct ID
   * @param {StackProps} props - Stack properties including environment configuration
   * @param {object} props.env - Environment configuration (account, region)
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const r2cFunction = new lambda.Function(this, 'r2c-function', {
      functionName: `R2CFunction-${props.env.region}`,
      runtime: lambda.Runtime.NODEJS_20_X, // Lambda runtime
      code: lambda.Code.fromAsset('resources/lambdas/'),
      handler: 'region-to-client.handler',
      environment: {
        THIS_REGION: Stack.of(this).region,
      },
    });

    r2cFunction.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const api = new CorsApiGateway(this, 'r2c-api', {
      apiName: `R2CAPI-${props.env.region}`,
      description: 'This service pings a given URL from this AWS region.',
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowOrigins: ['*']
    });

    api.addLambdaIntegration('r2c', r2cFunction);

    // region-to-client permissions
    r2cFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'ec2:DescribeRegions',
      ],
      resources: ['*'],
    }));

    new SSM.StringParameter(this, `r2c-api-ssm-${props.env.region}`, {
      parameterName: `R2CURL-${props.env.region}`,
      description: `The R2C URL for ${props.env.region}`,
      stringValue: api.api.url,
    });

  }
};

export { R2CStack };
