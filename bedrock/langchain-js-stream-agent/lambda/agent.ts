import { ChatBedrockConverse } from "@langchain/aws";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatBedrockConverse({
  model: "anthropic.claude-3-sonnet-20240229-v1:0",
  region: "us-east-1",
});

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

    const stream = await model.stream([
      new HumanMessage({ content: "Tell me a joke" }),
    ]);

    for await (const chunk of stream) {
      responseStream.write(chunk.content);
    }

    responseStream.end();
  }
);
