import * as cdk from "aws-cdk-lib";
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
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: join(__dirname, "..", "lambda", "agent.ts"),
      }
    );

    const agentFunctionUrl = agentFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    new cdk.CfnOutput(this, "agentFunctionUrlOutput", {
      value: agentFunctionUrl.url,
    });
  }
}
