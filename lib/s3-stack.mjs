import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SSMParameterReader } from './ssmParameterReader.mjs'

class S3Stack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
    
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

        /* CROSS-REGION DYNAMIC RESOURCE SHARING */
        // Utilizes AWS Custom Resource and SSM Parameter to import URLs for
        // Chatbot, R2R Database, and R2C API Endpoints
        // Used as a workaround for issue with s3Deploy.Source.jsonData not resolving
        // CloudFormation tokens correctly
        const configData = {};
        //configData[`VITE_CHATBOT_API_URL`] = SSM.StringParameter.valueForStringParameter(
          //this, `ChatbotAPIUrl`);
        configData[`VITE_CHATBOT_API_KEY`] = process.env.CHATBOT_API_KEY;
        props.regions.forEach(reg => {
          const parameterReader = new SSMParameterReader(this, `parameterReader-${reg}`, {
            parameterName: `R2CURL-${reg}`,
            region: reg
          });
          const url = parameterReader.getParameterValue();
          configData[`R2CURL-${reg}`] = url;
        });

        // Define __filename and __dirname for ES Modules
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
    
        new s3Deploy.BucketDeployment(this, 'ClientDeployment', {
          sources: [
            s3Deploy.Source.asset(path.join(__dirname, '../resources/client')),
            s3Deploy.Source.jsonData('config.json', configData),  // Add config.json to the deployment
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
    }
}

export { S3Stack };