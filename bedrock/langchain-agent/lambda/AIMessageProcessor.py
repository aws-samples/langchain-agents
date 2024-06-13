import json
import os
import boto3
from langchain_community.chat_models import BedrockChat
from chat import Chat
from Agent import Agent
from config import config

conversation_table_name = config.CONVERSATION_TABLE_NAME


def lambda_handler(event, context):
    print(event)
    chat = Chat(event)
    if is_user_request_to_start_new_conversation(event):
        print("Starting a new conversation")
        chat.create_new_chat()
        response_message = 'Your previous conversation has been saved. You are now ready to begin a new conversation.'
        return chat.http_response(response_message)
    user_message = get_user_message(event)
    llm = BedrockChat(model_id="anthropic.claude-3-sonnet-20240229-v1:0")
    langchain_agent = Agent(llm, chat.memory)
    message = langchain_agent.run(input=user_message)
    return chat.http_response(message)


def is_user_request_to_start_new_conversation(event):
    user_message = get_user_message(event)
    return "start a new conversation" in user_message.strip().lower()


def get_user_message(event):
    body = load_body(event)
    user_message_body = body['message']
    return user_message_body


def load_body(event):
    body = json.loads(event['body'])
    return body