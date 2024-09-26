import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { fileURLToPath } from 'url';

class S3Stack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        // Import the API URL from the Chatbot stack
        const chatbotApiUrl = cdk.Fn.importValue('ChatbotAPIUrl');
    
        const bucket = new s3.Bucket(this, 'ClientBucket', {
          bucketName: 'aws-yyc-client-bucket',
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          publicReadAccess: false,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    
        // Create a CloudFront distribution for the website
        const distribution = new cloudfront.Distribution(this, 'ClientDistribution', {
          defaultBehavior: {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            compress: true,
            origin: new cloudfrontOrigins.S3Origin(bucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          defaultRootObject: 'index.html',
          errorResponses: [
            {
              httpStatus: 403,
              responseHttpStatus: 403,
              responsePagePath: '/error.html',
              ttl: cdk.Duration.minutes(30),
            },
          ],
          minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2019,
        });

        // Create config.json with the chatbotApiUrl
        const configData = JSON.stringify({ VITE_CHATBOT_API_URL: chatbotApiUrl });

        // Define __filename and __dirname for ES Modules
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
    
        // Deploy the website contents to the S3 bucket by bundling the source files in /client
        // Creates a Node environment to execute build
        new s3Deploy.BucketDeployment(this, 'ClientDeployment', {
          sources: [
            s3Deploy.Source.asset(path.join(__dirname, '../resources/client'), {
              bundling: {
                image: cdk.BundlingDockerImage.fromRegistry('node:lts'), // Node environment via docker for building
                platform: 'linux/amd64',
                environment: { // env variable wasn't being read in the cmd above
                  VITE_CHATBOT_API_URL: chatbotApiUrl,  // Pass the value explicitly
                },
                command: [
                  'bash', '-c', 
                  'npm install && npm run build && cp -r dist/* /asset-output/',
                ],
              }}
            ),
            s3Deploy.Source.data('config.json', configData),  // Add config.json to the deployment
          ],
          destinationBucket: bucket,
          distribution,
          distributionPaths: ['/*'], // Invalidate the cache !!! Important
        });
    
        // Output CloudFront URL and Distribution ID as CloudFormation outputs
        new cdk.CfnOutput(this, 'CfnOutCloudFrontUrl', {
          value: `https://${distribution.distributionDomainName}`,
          description: 'The CloudFront URL',
        });
    
        new cdk.CfnOutput(this, 'CfnOutDistributionId', {
          value: distribution.distributionId,
          description: 'CloudFront Distribution Id',
        });
    }
}

export { S3Stack };