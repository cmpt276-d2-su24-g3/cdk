import { LambdaClient, CreateFunctionCommand, GetFunctionUrlConfigCommand } from '@aws-sdk/client-lambda'; // Import AWS Lambda SDK
import * as fs from 'fs'; // For writing the JSON file

export class R2CMainStack {
  constructor(props) {
    // JSON object to store Lambda URLs per region
    const lambdaUrls = {};

    // Define the list of regions (can be passed in dynamically via props)
    const regions = props.regions || ['us-east-1', 'us-west-2', 'eu-west-1'];

    // Loop through each region and create Lambda functions using AWS SDK
    regions.forEach(async (region) => {
      const r2cStackId = `R2CStack-${region}`;

      // Create the Lambda function for each region
      const lambdaUrl = await this.createLambdaInRegion(region, props.accountId, r2cStackId);

      // Store the Lambda URL in the JSON object
      lambdaUrls[region] = lambdaUrl;
    });

    // Once all Lambdas are created, write the URLs to a JSON file
    this.writeLambdaUrlsToFile(lambdaUrls);
  }

  async createLambdaInRegion(region, accountId, functionName) {
    const client = new LambdaClient({ region });

    try {
      // Create the Lambda function using AWS SDK
      const createFunctionCommand = new CreateFunctionCommand({
        FunctionName: functionName,
        Role: `arn:aws:iam::${accountId}:role/LambdaRole`, // Replace with your IAM role ARN
        Runtime: 'nodejs14.x', // Specify the runtime for your Lambda function
        Handler: 'index.handler', // Specify the handler for the Lambda function
        Code: {
          S3Bucket: 'my-bucket', // Replace with your S3 bucket
          S3Key: 'my-lambda-code.zip', // Replace with your Lambda code zip file
        },
      });

      await client.send(createFunctionCommand);
      console.log(`Lambda function ${functionName} created in ${region}.`);

      // Retrieve the Lambda function URL
      const functionUrlConfig = new GetFunctionUrlConfigCommand({ FunctionName: functionName });
      const { FunctionUrl } = await client.send(functionUrlConfig);

      console.log(`Lambda URL for ${region}: ${FunctionUrl}`);
      return FunctionUrl;

    } catch (error) {
      console.error(`Failed to create Lambda function in ${region}:`, error);
    }
  }

  writeLambdaUrlsToFile(lambdaUrls) {
    // Write the collected Lambda URLs to a file
    fs.writeFileSync('lambdaUrls.json', JSON.stringify(lambdaUrls, null, 2));
    console.log('Lambda URLs written to lambdaUrls.json');
  }
}
