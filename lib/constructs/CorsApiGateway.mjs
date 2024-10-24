import * as apigateway from 'aws-cdk-lib/aws-apigateway';

/**
 * Properties for CorsApiGateway
 * @typedef {Object} CorsApiGatewayProps
 * @property {string} apiName - Name of the API Gateway
 * @property {string} description - Description of the API Gateway
 * @property {string[]} [allowMethods=['GET', 'POST', 'OPTIONS']] - HTTP methods allowed by CORS
 * @property {string[]} [allowOrigins=['*']] - Origins allowed by CORS
 * @property {string[]} [allowHeaders] - Headers allowed by CORS
 */

/**
 * Creates an API Gateway with CORS enabled and common integration patterns
 */
export class CorsApiGateway extends Construct {
  /**
   * @param {Construct} scope - Parent construct
   * @param {string} id - Construct ID
   * @param {CorsApiGatewayProps} props - Configuration properties
   */
  constructor(scope, id, props) {
    super(scope, id);

    const {
      apiName,
      description,
      allowMethods = ['GET', 'POST', 'OPTIONS'],
      allowOrigins = ['*'],
      allowHeaders = ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
    } = props;

    // Use a unique ID for the RestApi
    this.api = new apigateway.RestApi(this, `${id}-api`, {
      restApiName: apiName,
      description,
      defaultCorsPreflightOptions: {
        allowOrigins,
        allowMethods,
        allowHeaders,
      },
    });

    // Use a unique ID for the gateway response
    this.api.addGatewayResponse(`${id}-4xx-response`, {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
        'Access-Control-Allow-Methods': "'*'",
      },
    });
  }

  /**
   * Adds a Lambda integration to the API
   * @param {string} path - Resource path
   * @param {lambda.Function} lambda - Lambda function to integrate
   * @param {string[]} [methods=['POST']] - HTTP methods to support
   * @param {string} [statusCode='200'] - Success status code
   * @returns {apigateway.Resource} The created API resource
   */
  addLambdaIntegration(path, lambda, methods = ['POST'], statusCode = '200') {
    const resource = this.api.root.addResource(path);
    const integration = new apigateway.LambdaIntegration(lambda);

    methods.forEach(method => {
      resource.addMethod(method, integration, {
        methodResponses: [{
          statusCode: statusCode.toString(),
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        }],
      });
    });

    return resource;
  }

  /**
   * Adds an HTTP integration to the API
   * @param {string} path - Resource path
   * @param {string} baseUrl - Base URL for the HTTP endpoint
   * @param {string} [method='POST'] - HTTP method
   * @param {string} [statusCode='200'] - Success status code
   * @returns {apigateway.Resource} The created API resource
   */
  addHttpIntegration(path, baseUrl, method = 'POST', statusCode = '200') {
    const integration = new apigateway.HttpIntegration(`${baseUrl}/${path}`, {
      httpMethod: method,
      options: {
        integrationResponses: [{ 
          statusCode: statusCode.toString(),
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          }
        }]
      }
    });

    const resource = this.api.root.addResource(path);
    resource.addMethod(method, integration, {
      methodResponses: [{
        statusCode: statusCode.toString(),
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        }
      }]
    });

    return resource;
  }
}
