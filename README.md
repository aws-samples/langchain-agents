# Secure Langchain Constructs on AWS with Different LLM Providers

Find the LLM provider that best suits your needs. This repository contains the code for supporting the following LLM providers:

- [AWS Bedrock](https://aws.amazon.com/bedrock/)
  - [Bedrock Knowledge Base, Lex, LangSmith Project](./bedrock/knowledge-base-lex-langsmith/)
  - [Bedrock LangChain Agent Project](./bedrock/langchain-agent/)
  - [Bedrock LangChain JS Stream Agent Project](./bedrock/langchain-js-stream-agent/)
- [OpenAI Project](https://openai.com/)
  - [OpenAI LangChain Agent](./openai/)

Currently the OpenAI stack includes a simple conversational Langchain agent running on AWS Lambda and using DynamoDB for memory that can be customized with tools and prompts. It also includes a simple web interface for interacting with the agent.

The AWS Bedrock stack includes a conversational chain running on AWS Lambda, using DynamoDB for memory, and a Bedrock Knowledge Base for RAG. It is fronted through Amazon Lex and can be connected to Amazon Connect for a full call center experience. There is also a simple agent that can be deployed with Bedrock.

## Creating a new Lambda Layer with the latest Langchain SDK

To create a new Lambda Layer compatible with the latest Python runtime and the latest langchain, boto3 or openai package you can: Go into Amazon Codebuild. [Pick the runtime you are trying to build the Lambda Layer for](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html). Set the source as none and in the buildspec add the following:

```yaml
version: 0.2

phases:
  build:
    commands:
      - pip config set global.target ""
      - mkdir -p package/python
      - pip install --target package/python boto3
      - pip install --target package/python numpy
      - pip install --target package/python langchain
      - cd package && zip ../package.zip * -r

artifacts:
  files:
    - "package.zip"
```

For the artifact location pick the S3 bucket where you want the created zip file to go. Then just download that zip and use it to create the Lambda Layer.

Note: This will create a zip file with the latest langchain, boto3 and numpy packages. To create one with openai instead swap boto3 for openai in the yaml commands.
