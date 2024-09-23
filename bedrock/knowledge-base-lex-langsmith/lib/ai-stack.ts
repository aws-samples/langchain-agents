import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as lex from 'aws-cdk-lib/aws-lex';
import { NagSuppressions } from 'cdk-nag';
import * as dotenv from 'dotenv';
import { Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as uuid from "uuid";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { join } from 'path';

dotenv.config();

let knowledge_base_id = process.env.KNOWLEDGE_BASE_ID!;

export class AIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    if (!knowledge_base_id) {

      const wspBucket = new s3.Bucket(this, "WhatsappBucket" + uuid.v4(),
        {
          lifecycleRules: [{
            expiration: Duration.days(10),
          }],
          blockPublicAccess: {
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
          },
          encryption: s3.BucketEncryption.S3_MANAGED,
          enforceSSL: true,
          removalPolicy: RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
        });

        // Add CDK Nag suppression for wildcard resource
        NagSuppressions.addResourceSuppressions(wspBucket, 
          [
           { 
            id: 'AwsSolutions-S1', 
            reason: 'The S3 Bucket has server access logs disabled.'
           }
          ]
        );

      const wspKnowledgeBase = new bedrock.KnowledgeBase(
        this,
        "WhatsappKnowledgeBase",
        {
          embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1
        }
      );

      NagSuppressions.addResourceSuppressionsByPath(
        this,
        '/ServerlessAIStack/LogRetentionaae0aa3c5b4d4f87b02d85b201efdd8a/ServiceRole',
        [
          {
            id: 'AwsSolutions-IAM4',
            reason: 'CDK CustomResource LogRetention Lambda uses the AWSLambdaBasicExecutionRole AWS Managed Policy. Managed by CDK.',
          },
          {
            id: 'AwsSolutions-IAM5',
            reason: 'CDK CustomResource LogRetention Lambda uses a wildcard to manage log streams created at runtime. Managed by CDK.',
          },
        ],
        true,
      );

      const docsDataSource = new bedrock.S3DataSource(
        this,
        "WhatsappDataSource",
        {
          bucket: wspBucket,
          knowledgeBase: wspKnowledgeBase,
          dataSourceName: "Whatsapp",
          chunkingStrategy: bedrock.ChunkingStrategy.FIXED_SIZE,
          maxTokens: 1024,
          overlapPercentage: 20,
        }
      );

      const s3PutEventSource = new S3EventSource(wspBucket, {
        events: [s3.EventType.OBJECT_CREATED_PUT],
      });

      // Defines a lambda execution role
      const lambdaIngestionRole = new iam.Role(this, 'lambdaIngestionRole', {
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
                  `arn:aws:logs:${props?.env?.region}:${props?.env?.account}:log-group:/aws/lambda/start-ingestion-trigger:*`
                ]
              }),
              new iam.PolicyStatement({
                actions: ["bedrock:StartIngestionJob"],
                resources: [wspKnowledgeBase.knowledgeBaseArn],
              })
            ]
          })
        }
      });

      const lambdaIngestionJob = new NodejsFunction(this, 'IngestionJob', {
        runtime: Runtime.NODEJS_20_X,
        entry: join(__dirname, '../lambda/index.js'),
        functionName: `start-ingestion-trigger`,
        timeout: Duration.minutes(15),
        environment: {
          KNOWLEDGE_BASE_ID: wspKnowledgeBase.knowledgeBaseId,
          DATA_SOURCE_ID: docsDataSource.dataSourceId,
        },
        role: lambdaIngestionRole,
      });

      lambdaIngestionJob.addEventSource(s3PutEventSource);

      // Add CDK Nag suppression for wildcard resource
      NagSuppressions.addResourceSuppressions(lambdaIngestionRole, [{
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permission is needed to create custom Lambda execution role to write to CloudWatch Logs.'
      }],
        true
      );

      NagSuppressions.addResourceSuppressionsByPath(
        this,
        '/ServerlessAIStack/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role',
        [
          {
            id: 'AwsSolutions-IAM4',
            reason: 'CDK CustomResource BucketNotifications Lambda uses the AWSLambdaBasicExecutionRole AWS Managed Policy. Managed by CDK.',
          },
          {
            id: 'AwsSolutions-IAM5',
            reason: 'CDK CustomResource BucketNotifications Lambda uses a wildcard to manage log streams created at runtime. Managed by CDK.',
          },
        ],
        true,
      );

      knowledge_base_id = wspKnowledgeBase.knowledgeBaseId;

      new CfnOutput(this, "WhatsappBucketName", {
        value: wspBucket.bucketName,
      });

      new CfnOutput(this, "WhatsappknowledgeBaseId", {
        value: wspKnowledgeBase.knowledgeBaseId,
      });
    }

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
                `arn:aws:bedrock:${props?.env?.region}::foundation-model/${bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_SONNET_V1_0}`,
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
    NagSuppressions.addResourceSuppressions(lambdaRole, [{
      id: 'AwsSolutions-IAM5',
      reason: 'Wildcard permission is needed to create custom Lambda execution role to write to CloudWatch Logs'
    }],
      true
    );

    // Build Langchain layer that includes Bedrock from layers/langchain-layer.zip
    const langchainBedrockLayer = new lambda.LayerVersion(this, 'LangchainLayer', {
      code: lambda.Code.fromAsset('layers/langchain-bedrock/langchain-aws.zip'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Langchain Layer Version 0.1.4',
      license: 'MIT',
      layerVersionName: 'langchain-layer',
    });

    // Add Langchain layer to Lambda function
    LexMessageProcessor.addLayers(langchainBedrockLayer);

    // Grant Lambda function access to DynamoDB tables
    conversationTable.grantReadWriteData(LexMessageProcessor);

    const langchainAPIKeyParam = new cdk.CfnParameter(this, 'langchainAPIKey', {
      type: 'String',
      description: 'Langsmith API Key.',
      default: process.env.LANGCHAIN_API_KEY || '',
    });

    // Stores Langsmith API key in AWS SSM Parameter Store
    const langchainAPIKey = new ssm.StringParameter(this, 'LANGCHAIN_API_KEY', {
      description: 'Langsmith API Key',
      stringValue: langchainAPIKeyParam.valueAsString,
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
      }
    })

    // Add CDK Nag suppression for wildcard resource
    NagSuppressions.addResourceSuppressions(lexRole, [{
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
          sampleUtterances: [{ 'utterance': 'Hello' }],
          intentClosingSetting: {
            closingResponse: {
              messageGroupsList: [{
                message: {
                  plainTextMessage: { value: 'Hello. How can I help you?' },
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
