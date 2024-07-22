import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { Calculator } from "@langchain/community/tools/calculator";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";

/**
 * AWS Lambda with Streaming Response
 * This functionality enables the AWS Lambda to send back a streaming response to the caller.
 * For more details, refer to the AWS documentation:
 * https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
 *
 * LangChain Agent Creation
 * Utilizes the LangChain API to create a reactive agent equipped with various tools.
 * More information can be found at:
 * https://v02.api.js.langchain.com/functions/langchain_agents.createReactAgent.html
 */
export const handler = awslambda.streamifyResponse(
  async (_evt, responseStream, _context) => {
    // Set the response content type to text/event-stream
    // See https://github.com/serverless/serverless/discussions/12090#discussioncomment-6685223
    const metadata = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    };
    responseStream = awslambda.HttpResponseStream.from(
      responseStream,
      metadata
    );

    class CustomHandler extends BaseCallbackHandler {
      name = "custom_handler";

      handleLLMNewToken(token: string) {
        responseStream.write(`token: ${token}\n`);
      }
    }

    const llm = new BedrockChat({
      model: "anthropic.claude-3-sonnet-20240229-v1:0",
      region: "us-east-1",
      streaming: true,
      callbacks: [new CustomHandler()],
    });

    const tools = [new Calculator()];

    const prompt = await pull<PromptTemplate>("hwchase17/react");

    const agent = await createReactAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    await agentExecutor.invoke({
      input: "What is 2 to the power of 8?",
    });

    responseStream.end();
  }
);
