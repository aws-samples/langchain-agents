# Deploy Langchain using Claude on Bedrock, Amazon Lex, and LangSmith

## Requirements

- [Create an AWS account](https://portal.aws.amazon.com/gp/aws/developer/registration/index.html) if you do not already have one and log in. The IAM user that you use must have sufficient permissions to make necessary AWS service calls and manage AWS resources.
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured
- [Git Installed](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [AWS Cloud Development Kit](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (AWS CDK) v2 Installed
- [NodeJS and NPM](https://nodejs.org/en/download/) Installed
- [Bedrock Model Access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) Request Access for Anthropic Claude 3 Sonnet.
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

Note: Project ID should be a descriptive title of the project you are building, i.e. ai-assistant. Deploy account ID should contain the AWS account ID you want to deploy to. If you want to proceed without a LangSmith API Key just fill in a dumby value such as NONE.

If you have an existing knowledge base you want to reusue you can add the variable:

```
KNOWLEDGE_BASE_ID=<knowlege_base_id>
```

3. Install the project dependencies:

```
npm install
```

4. The package [generative-ai-cdk-constructs](https://github.com/awslabs/generative-ai-cdk-constructs) should be added to your package.json.

```
npm install @cdklabs/generative-ai-cdk-constructs
```

5. Use AWS CDK to synthesize an AWS CloudFormation:

```
npx cdk synth
```

6. Use AWS CDK to deploy the AWS resources for the pattern:

```
npx cdk deploy --require-approval never
```

## Use the Pre-Built AWS CloudFormation Template
1. Log into the [AWS Console](https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1) if you are not already. 
2. Choose the Launch Stack button below for your desired AWS region to open the [AWS CloudFormation console](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks?filteringText=&filteringStatus=active&viewNested=true) and create a new stack. 
3. Enter the following parameters: 
    - StackName: Name your Stack, e.g. WhatsAppAIStack. 
    - LangchainAPIKey: The API key generated through [LangChain](https://docs.smith.langchain.com/how_to_guides/setup/create_account_api_key).
    - Check the box to acknowledge creating IAM resources and click “Create Stack”.
    - Wait for the stack creation to complete.
    
Region | Easy Deploy Button | Template URL - use to upgrade existing stack to a new release
--- | --- | ---
N. Virginia (us-east-1) | [![Launch Stack](https://cdn.rawgit.com/buildkite/cloudformation-launch-stack-button-svg/master/launch-stack.svg)](https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/review?templateURL=https://aws-blogs-artifacts-public.s3.amazonaws.com/ML-16776/template.yml) | [YML](https://aws-blogs-artifacts-public.s3.amazonaws.com/ML-16776/template.yml)

Note: Upload files to the data source (S3) created for WhatsApp. As soon as you upload a file, the data source will synchronize automatically.

## Testing

1. Navigate to Amazon Lex in your AWS account.

2. Select the bot that was created by the CDK deployment, LangchainBedrockExample.

3. Select the Test bot button.

4. Enter a message in the text box and press the Enter key.

5. Navigate to [Langsmith](https://smith.langchain.com) and check the trace of the app.

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