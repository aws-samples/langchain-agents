# Deploy Langchain using Claude on Bedrock, Amazon Lex, and LangSmith

## Requirements

- [Create an AWS account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) if you do not already have one and log in. The IAM user that you use must have sufficient permissions to make necessary AWS service calls and manage AWS resources.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured
- [Git Installed](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [AWS Cloud Development Kit](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (AWS CDK) v2 Installed
- [NodeJS and NPM](https://nodejs.org/en/download/) Installed
- [Bedrock Model Access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) Request Access for Anthropic Claude V1 Instant
- [Bedrock Knowledge Base](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html) Create a Knowledge Base, set a data source, and sync it
- [Langsmith](https://python.langchain.com/docs/get_started/quickstart) Generate a Langchain API key (free)

## Architecture Overview
![Alt text](./architecture_diagram.jpg?raw=true "Architecture")

## Deployment Instructions

1. Clone the repository and navigate to it:

```
git clone https://github.com/aws-samples/langchain-agents.git
cd langchain-agents/bedrock/knowledge-base-lex-langsmith
```

2. Copy .env.sample to .env and update the values with your own:

```
cp .env.sample .env
```

3. Install the project dependencies:

```
npm install
```

4. Use AWS CDK to synthesize an AWS CloudFormation:

```
npx cdk synth
```

5. Use AWS CDK to deploy the AWS resources for the pattern:

```
npx cdk deploy --require-approval never
```

## Testing

1. Navigate to Amazon Lex in your AWS account.

2. Select the bot that was created by the CDK deployment, LangchainBedrockExample.

3. Select the Test bot button.

4. Enter a message in the text box and press the Enter key.

5. Navigate to [https://smith.langchain.com](Langsmith) and check the trace of the app.

![Alt text](./langsmith_trace.png?raw=true "LangSmith trace")

## Cleanup

1. To delete the stack, run:

```
npx cdk destroy
```

## Useful commands

- `cdk ls` list all stacks in the app
- `cdk synth` emits the synthesized CloudFormation template
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk docs` open CDK documentation

## Amazon Connect

To connect the Amazon Lex bot to Amazon Connect, follow the instructions to [Add the Amazon Lex bot to your Amazon Connect instance](https://docs.aws.amazon.com/connect/latest/adminguide/amazon-lex.html#lex-bot-add-to-connect).