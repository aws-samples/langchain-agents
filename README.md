# Secure Langchain Constructs on AWS with Different LLM Providers

Find the LLM provider that best suits your needs. This repository contains the code for supporting the following LLM providers:

- [AWS Bedrock](https://aws.amazon.com/bedrock/)
- [OpenAI](https://openai.com/)

Currently the OpenAI stack includes a simple conversational Langchain agent running on AWS Lambda and using DynamoDB for memory that can be customized with tools and prompts. It also includes a simple web interface for interacting with the agent.

The AWS Bedrock stack includes a conversational chain running on AWS Lambda, using DynamoDB for memory, and a Bedrock Knowledge Base for RAG. It is fronted through Amazon Lex and can be connected to Amazon Connect for a full call center experience.