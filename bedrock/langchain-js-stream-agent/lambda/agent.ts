import { BedrockChat } from "@langchain/community/chat_models/bedrock";
import { Calculator } from "@langchain/community/tools/calculator";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { PromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";

export const handler = awslambda.streamifyResponse(
  async (_evt, responseStream, _context) => {
    // Set the response metadata
    const metadata = {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    };

    // Wrap the response stream
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
