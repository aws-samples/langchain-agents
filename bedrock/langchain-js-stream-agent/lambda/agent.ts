import { LambdaFunctionURLHandler } from "aws-lambda";

export const handler: LambdaFunctionURLHandler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify("Hello TS!"),
  };
};
