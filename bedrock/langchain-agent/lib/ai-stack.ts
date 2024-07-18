import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NagSuppressions } from 'cdk-nag';

export class LangchainAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defines a DynamoDB to keep track of customer conversation
    const conversationIndexTable = new dynamodb.Table(this, 'ConversationIndexTable', {
      partitionKey: { name: 'UserId', type: dynamodb.AttributeType.STRING },
      tableName: 'ConversationIndexTable',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Defines a DynamoDB Table to store conversations
    const conversationTable = new dynamodb.Table(this, 'ConversationTable', {
      partitionKey: { name: 'SessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // //Enable point-in-time recovery
      // pointInTimeRecovery: true,
      // //Delete the table after the stack is deleted
      // removalPolicy: cdk.RemovalPolicy.DESTROY, //or RETAIN in prod
    });

    // Defines a Cognito User Pool for user authentication 
    const userPool = new cognito.UserPool(this, 'userPool', {
      userPoolName: 'user-pool',
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, //or RETAIN in prod
      // Enable MFA 
      // mfa: cognito.Mfa.REQUIRED,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfaSecondFactor: {
          sms: false,
          otp: true,
      },
      signInAliases: {
        phone: true,
        email: true,
      },
      autoVerify: {
        email: true,
      },
      keepOriginal: {
        email: true,
    },
      standardAttributes: {
        phoneNumber: {  
          required: true,
        },
        email: {
          required: true, 
        },
       givenName: { 
          required: true,
       },
      },
      enableSmsRole: false,
      passwordPolicy: { 
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      advancedSecurityMode: cognito.AdvancedSecurityMode.ENFORCED
    });

    //Defines the domain associated with the user pool
    new cognito.UserPoolDomain(this, 'userPoolDomain', {
      userPool, 
      cognitoDomain: {
        domainPrefix: 'langchain-bedrock-test', //needs to be unqiue
      }
    });

    //Defines a web client for the user pool without secret
    const userPoolClientWeb = new cognito.UserPoolClient(this, 'userPoolClientWeb', {
      userPool: userPool,
      userPoolClientName: 'user-pool-client-web',
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: ['http://localhost:3000/'],
        logoutUrls: ['http://localhost:3000/']
      }
    });

    //Defines a native client for the user pool with secret
    const userPoolClientNative = new cognito.UserPoolClient(this, 'userPoolClientNative', {
      userPool: userPool,
      userPoolClientName: 'user-pool-client-native',
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: ['http://localhost:3000/'],
        logoutUrls: ['http://localhost:3000/']
      },
      generateSecret: true
    });


    // Defines an Identity Pool for user authorization
    const identityPool = new cognito.CfnIdentityPool(this, 'identityPool',{
      identityPoolName: 'identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: userPoolClientWeb.userPoolClientId,
        providerName:userPool.userPoolProviderName,
      },
      {
        clientId: userPoolClientNative.userPoolClientId,
        providerName:userPool.userPoolProviderName,
      }]
    });

    // Defines an IAM Role that will be assumed by authenticated users of User Pool
    const cognitoRole = new iam.Role(this, 'cognitoUserPoolRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', { 
        'StringEquals': {
          'cognito-identity.amazonaws.com:aud' : identityPool.ref,
        },
        "ForAnyValue:StringLike" : {
          "cognito-identity.amazonaws.com:amr" : "authenticated"
        },
      }, 'sts:AssumeRoleWithWebIdentity'),
    });

    // Defines an IAM Role that will be assumed by unauthenticated users of User Pool
    const cognitoUnauthRole = new iam.Role(this, 'cognitoUserPoolUnauthRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', { 
        'StringEquals': {
          'cognito-identity.amazonaws.com:aud' : identityPool.ref,
        },
        "ForAnyValue:StringLike" : {
          "cognito-identity.amazonaws.com:amr" : "unauthenticated"
        },
      }, 'sts:AssumeRoleWithWebIdentity'),
    });

    // Defines a lambda execution role
    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // Defines a Python Lambda resource AIMessageProcessor that has a function
    const AIMessageProcessor = new lambda.Function(this, 'AIMessageProcessor', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'AIMessageProcessor.lambda_handler',
      timeout: cdk.Duration.seconds(120),
      architecture: lambda.Architecture.ARM_64,
      role: lambdaRole,
      memorySize: 256,
    });

    // Defines a policy to the Lambda execution role that allows it to access CloudWatch Logs
    AIMessageProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: ['*']
    }));


    // Invoke Bedrock permission
    AIMessageProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [`arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`]
    }));

    // Defines CDK Nag rule suppression for wildcard permission for lambda execution role
    NagSuppressions.addResourceSuppressions(lambdaRole,  [{ 
      id: 'AwsSolutions-IAM5', 
      reason: 'Wildcild permission is needed to create custom Lambda execution role to write to CloudWatch Logs'
    }],
    true
    );

    // Defines IAM permission to the functoin to allow Cognito Identity Pool to invoke it
    AIMessageProcessor.addPermission('allowCognitoIdentityPoolInvoke', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceArn: `arn:aws:cognito-identity:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:identitypool/${identityPool.ref}`
    });

    // Defines a policy to the Cognito User Pool Role that allows it to invoke the AIMessageProcess Lambda function
    const authUserPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunctionUrl'], 
      resources: [AIMessageProcessor.functionArn],
    });

    cognitoRole.addToPolicy(authUserPolicy);

    // Add the policy to the authenticated role for the Identity Pool
    const authUserRole = new cognito.CfnIdentityPoolRoleAttachment(this, 'identityPoolRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        authenticated: cognitoRole.roleArn,
        unauthenticated: cognitoUnauthRole.roleArn,
      },
    });

    authUserRole.addDependency(identityPool);

    // Defines a lambda function URL with secure authType
    const lambdaUrl = AIMessageProcessor.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      cors: {
        allowCredentials: true,
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        exposedHeaders: ['*'],
        maxAge: cdk.Duration.seconds(86400),
      }
    });

    // Build Langchain layer that includes Bedrock from ../layers/langchain-aws.zip
    const langchainLayer = new lambda.LayerVersion(this, 'LangchainLayer', {
      code: lambda.Code.fromAsset('../knowledge-base-lex-langsmith/layers/langchain-bedrock/langchain-aws.zip'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Langchain Layer',
      license: 'MIT',
      layerVersionName: 'langchain-layer',
    });
    AIMessageProcessor.addLayers(langchainLayer);

    // Grant Lambda function access to DynamoDB tables
    conversationIndexTable.grantReadWriteData(AIMessageProcessor);
    conversationTable.grantReadWriteData(AIMessageProcessor);

    // Pass DynamoDB table names to Lambda function
    AIMessageProcessor.addEnvironment('CHAT_INDEX_TABLE_NAME', conversationIndexTable.tableName);
    AIMessageProcessor.addEnvironment('CONVERSATION_TABLE_NAME', conversationTable.tableName);

    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: lambdaUrl.url,
    })
    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
    })
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    })
    new cdk.CfnOutput(this, 'UserPoolClientIdWeb', {
      value: userPoolClientWeb.userPoolClientId,
    })
    new cdk.CfnOutput(this, 'UserPoolClientIdNative', {
      value: userPoolClientNative.userPoolClientId,
    })
  }
}
