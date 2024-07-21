import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join } from "path";

export class LangchainJsStreamAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const agentFunction = new lambdaNodejs.NodejsFunction(
      this,
      "AgentFunction",
      {
        entry: join(__dirname, "..", "lambda", "agent.ts"),
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_20_X,
        bundling: {
          externalModules: [],
        },
      }
    );

    const agentFunctionUrl = agentFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    const bedrockModelPolicy = new iam.PolicyStatement({
      actions: ["bedrock:InvokeModelWithResponseStream"],
      effect: iam.Effect.ALLOW,
      resources: [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
      ],
    });

    agentFunction.addToRolePolicy(bedrockModelPolicy);

    new cdk.CfnOutput(this, "agentFunctionUrlOutput", {
      value: agentFunctionUrl.url,
    });
  }
}
