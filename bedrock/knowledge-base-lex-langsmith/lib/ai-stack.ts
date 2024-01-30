import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lex from 'aws-cdk-lib/aws-lex';
import { NagSuppressions } from 'cdk-nag';
import * as dotenv from 'dotenv';

dotenv.config();

const knowledge_base_id = process.env.KNOWLEDGE_BASE_ID!;

export class AIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines a DynamoDB Table to store conversations
    const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
      partitionKey: { name: 'SessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // //Enable point-in-time recovery
      // pointInTimeRecovery: true,
      // //Delete the table after the stack is deleted
      // removalPolicy: cdk.RemovalPolicy.DESTROY, //or RETAIN in prod
    });

    // Defines a lambda execution role
    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        'LambdaBasicExecution': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents'
              ],
              resources: [
                `arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:/aws/lambda/LexBedrockMessageProcessor:*`
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel',
              ],
              resources: [
                `arn:aws:bedrock:${props?.env?.region}::foundation-model/anthropic.claude-instant-v1`,
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:Retrieve',
              ],
              resources: [
                `arn:aws:bedrock:${props?.env?.region}:${props?.env?.account}:knowledge-base/${knowledge_base_id}`,
              ]
            }),
          ]
        })
      }
    });

    // Defines a Python Lambda resource AIMessageProcessor that has a function
    const LexMessageProcessor = new lambda.Function(this, 'LexBedrockMessageProcessor', {
      runtime: lambda.Runtime.PYTHON_3_12,
      functionName: 'LexBedrockMessageProcessor',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'LexBedrockMessageProcessor.lambda_handler',
      timeout: cdk.Duration.seconds(120),
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      role: lambdaRole,
    });

    LexMessageProcessor.grantInvoke(new iam.ServicePrincipal('lex.amazonaws.com'))

    // Add CDK Nag suppression for wildcard resource
    NagSuppressions.addResourceSuppressions(lambdaRole,  [{ 
      id: 'AwsSolutions-IAM5', 
      reason: 'Wildcard permission is needed to create custom Lambda execution role to write to CloudWatch Logs'
    }],
    true
    );

    // Build Langchain layer that includes Bedrock from layers/langchain-layer.zip
    const langchainBedrockLayer = new lambda.LayerVersion(this, 'LangchainLayer', {
      code: lambda.Code.fromAsset('layers/langchain-bedrock'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Langchain Layer Version 0.1.4',
      license: 'MIT',
      layerVersionName: 'langchain-layer',
    });

    // Add Langchain layer to Lambda function
    LexMessageProcessor.addLayers(langchainBedrockLayer);

    // Grant Lambda function access to DynamoDB tables
    conversationTable.grantReadWriteData(LexMessageProcessor);

    // Stores Langsmith API key in AWS SSM Parameter Store
    const langchainAPIKey = new ssm.StringParameter(this, 'LANGCHAIN_API_KEY', {
      description: 'Langsmith API Key',
      stringValue: process.env.LANGCHAIN_API_KEY!,
    });

    langchainAPIKey.grantRead(LexMessageProcessor);

    LexMessageProcessor.addEnvironment('KNOWLEDGE_BASE_ID', knowledge_base_id);
    // Pass DynamoDB table names to Lambda function
    LexMessageProcessor.addEnvironment('CONVERSATION_TABLE_NAME', conversationTable.tableName);
    // For tracing
    LexMessageProcessor.addEnvironment('LANGCHAIN_TRACING_V2', "true");
    LexMessageProcessor.addEnvironment('LANGSMITH_ENDPOINT', 'https://api.langsmith.com');
    LexMessageProcessor.addEnvironment('LANGCHAIN_API_KEY_PARAMETER_NAME', langchainAPIKey.parameterName);
    LexMessageProcessor.addEnvironment('LANGCHAIN_PROJECT', `Claude-Agent-With-KB-${knowledge_base_id}`);

    const lexRole = new iam.Role(this, 'LexRole', {
      assumedBy: new iam.ServicePrincipal('lex.amazonaws.com'),
      inlinePolicies: {
        'LexBasicExecution': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'polly:SynthesizeSpeech',
              ],
              resources: [
                `*`,
              ]
            }),
            // Put intent
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lex:PutIntent',
              ],
              resources: [
                `arn:aws:lex:${props?.env?.region}:${props?.env?.account}:intent:LangchainBedrockExample:*`,
              ]
            }),
          ]
        })
      }})
    
    // Add CDK Nag suppression for wildcard resource
    NagSuppressions.addResourceSuppressions(lexRole,  [{ 
      id: 'AwsSolutions-IAM5', 
      reason: 'Wildcard permission is needed to create custom Lex execution role to use Polly Voices'
    }],);

    // Defines the Test Bot Alias
    const testBotAliasSettingsProperty: lex.CfnBot.TestBotAliasSettingsProperty = {
      botAliasLocaleSettings: [{
        botAliasLocaleSetting: {
          enabled: true,
          codeHookSpecification: {
            lambdaCodeHook: {
              codeHookInterfaceVersion: '1.0',
              lambdaArn: LexMessageProcessor.functionArn,
            },
          },
        },
        localeId: 'en_US',
      }],
      description: 'Langchain Bedrock Test Bot Alias',
      sentimentAnalysisSettings: {
        DetectSentiment: false,
      },
    };

    // Defines a Lex bot
    const bot = new lex.CfnBot(this, 'Bot', {
      name: 'LangchainBedrockExample',
      roleArn: lexRole.roleArn,
      idleSessionTtlInSeconds: 300,
      dataPrivacy: {
        ChildDirected: false,
      },
      autoBuildBotLocales: true,
      testBotAliasSettings: testBotAliasSettingsProperty,
      botLocales: [{
        localeId: 'en_US',
        nluConfidenceThreshold: 0.9,
        description: 'Langchain Bedrock Example Bot',
        voiceSettings: {
          voiceId: 'Danielle',
        },
        intents: [{
          name: 'Hello',
          sampleUtterances: [{'utterance': 'Hello'}],
          intentClosingSetting: {
            closingResponse: {
              messageGroupsList: [{
                message: {
                  plainTextMessage: {value: 'Hello. How can I help you?'},
                },
              }],
            },
            nextStep: {
              'dialogAction': {
                type: 'ElicitIntent',
              }
            }
          }
          },
          // Fallback Intent
          {
            name: 'FallbackIntent',
            parentIntentSignature: 'AMAZON.FallbackIntent',
            description: 'Invokes LexMessageProcessor Lambda function',
            fulfillmentCodeHook: {
              enabled: true,
            },
          },
      ]
    }]
    });
  }
}
