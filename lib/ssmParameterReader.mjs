import { AwsCustomResource } from 'aws-cdk-lib/custom-resources';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam'

/**
 * Custom wrapper resource around SSM for cross-region parameter sharing
 * 
 * props: parameterName (R2C-region), region
 */
export class SSMParameterReader extends AwsCustomResource {
  constructor(scope, name, props) {
    const { parameterName, region } = props;

    const ssmAwsSdkCall = {
      service: 'SSM',
      action: 'getParameter',
      parameters: {
        Name: parameterName
      },
      region,
      physicalResourceId: Date.now().toString() // Update physical id to always fetch the latest version
    };

    super(scope, name, { onUpdate: ssmAwsSdkCall,policy:{
        statements:[new PolicyStatement({
        resources : ['*'],
        actions   : ['ssm:GetParameter'],
        effect: Effect.ALLOW,
      }
      )]
    }});
  }

  getParameterValue() {
    return this.getResponseField('Parameter.Value').toString();
  }
}