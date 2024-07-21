# LangChain JS Stream Agent

Serverless implementation of a LangChain agent using AWS Lambda and Bedrock.

## Getting Started

This guide will walk you through the steps required to deploy the stack using the AWS Cloud Development Kit (CDK).

### Prerequisites

- AWS CLI installed and configured
- Node.js and npm installed
- AWS CDK installed (`npm install -g aws-cdk`)
- Docker (to use NodejsFunction)
- Claude 3 Sonnet enabled in Bedrock

### Warning

Please be aware that the URL of the Lambda function will be public after deployment.
Secure this URL using an authentication mechanism to prevent unauthorized access.

### Deploy

1. Install dependencies:

```bash
npm install
```

2. Deploy the stack using CDK:

```bash
cdk deploy
```

CDK will use Docker to build the Lambda function for the right architecture and runtime.

Once the deployment is done, the Lambda URL will be displayed in the outputs:

```
Outputs:
LangchainJsStreamAgentStack.agentFunctionUrlOutput = https://XXXXXXXXXX.lambda-url.us-east-1.on.aws/
```

3. Test the agent:

```bash
curl https://XXXXXXXXXX.lambda-url.us-east-1.on.aws/
```

The agent is streaming the response to the question: `What is 2 to the power of 8?` after using the calculator tool:

```
token:
token:
token:
token: Thought
token: :
token:  I
token:  now
token:  know
token:  the
token:  final
token:  answer
token:
Final
token:  Answer
token: :
token:
token: 2
token:
token: to
token:  the
token:  power
token:  of
token:
token: 8
token:
token: is
token:
token: 256
token: .
token:
token:
```

### Cleanup

When you are done, you can remove all the resources:

```bash
cdk destroy
```
