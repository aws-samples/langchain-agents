import boto3
import os
from boto3.dynamodb.types import TypeSerializer
from langchain.memory.chat_message_histories import DynamoDBChatMessageHistory
from langchain.memory import ConversationBufferMemory
from config import config

from datetime import datetime
import json

now = datetime.now()
dynamodb = boto3.client('dynamodb')
ts = TypeSerializer()

conversation_table_name = config.CONVERSATION_TABLE_NAME
chat_index_table_name = config.CHAT_INDEX_TABLE_NAME

class Chat():
    def __init__(self, event):
        self.set_user_identity(event)
        self.set_memory()
        self.set_chat_index()

    def set_memory(self):
        _id = self.user_id
        self.message_history = DynamoDBChatMessageHistory(
            table_name=conversation_table_name, session_id=_id)
        self.memory = ConversationBufferMemory(
            memory_key="chat_history", chat_memory=self.message_history, return_messages=True)

    def set_user_identity(self, event):
        body = json.loads(event['body'])
        self.user_id = body['userId']


    def http_response(self, message):
        return {
            'statusCode': 200,
            'body': json.dumps(message)
        }
    
    def create_new_chat(self):
        self.increment_chat_index()

    def set_chat_index(self):
        self.chat_index = self.get_chat_index()

    def get_chat_index(self):
        key = {'UserId':self.user_id}
        chat_index = dynamodb.get_item(TableName=chat_index_table_name, Key=ts.serialize(key)['M'])
        if 'Item' in chat_index:
            return int(chat_index['Item']['chat_index']['N'])
        return 0
    
    def increment_chat_index(self):
        self.chat_index += 1
        input = {
            'UserId': self.user_id,
            'chat_index': self.chat_index,
            'updated_at': str(now)
        }
        dynamodb.put_item(TableName=chat_index_table_name, Item=ts.serialize(input)['M'])