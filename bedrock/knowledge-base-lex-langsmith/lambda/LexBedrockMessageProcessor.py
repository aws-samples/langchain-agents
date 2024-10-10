from langchain_community.chat_models import BedrockChat
from langchain_aws.retrievers import AmazonKnowledgeBasesRetriever
from langchain.schema import HumanMessage, AIMessage
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
import boto3
import os
import json

model_id = "anthropic.claude-3-haiku-20240307-v1:0"

def lambda_handler(event, context):
    set_langchain_api_key()
    bedrock_client = boto3.client("bedrock-runtime")
    llm = BedrockChat(model_id=model_id, client=bedrock_client)
    session_id = event['sessionId']
    history = DynamoDBChatMessageHistory(
        table_name=os.environ["CONVERSATION_TABLE_NAME"],
        session_id=session_id,
    )
    retriever = AmazonKnowledgeBasesRetriever(
        knowledge_base_id=os.environ["KNOWLEDGE_BASE_ID"],
        retrieval_config={"vectorSearchConfiguration": {"numberOfResults": 3}}
    )
    user_message = event["inputTranscript"]
    qa_system_prompt = """You are an assistant for question-answering tasks. \
    Use the following pieces of retrieved context to answer the question. \
    If you don't know the answer, just say that you don't know. \
    Use three sentences maximum and keep the answer concise.\

    {context}"""
    contextualize_q_system_prompt = """Given a chat history and the latest user question \
    which might reference context in the chat history, formulate a standalone question \
    which can be understood without the chat history. Do NOT answer the question, \
    just reformulate it if needed and otherwise return it as is."""
    contextualize_q_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )
    contextualize_q_chain = contextualize_q_prompt | llm | StrOutputParser()
    qa_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", qa_system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{question}"),
        ]
    )


    def contextualized_question(input: dict):
        if input.get("chat_history"):
            return contextualize_q_chain
        else:
            return input["question"]


    rag_chain = (
        RunnablePassthrough.assign(
            context=contextualized_question | retriever | format_docs
        )
        | qa_prompt
        | llm
    )
    response = rag_chain.invoke({"question": user_message, "chat_history": history.messages})
    # Add user message and AI message
    history.add_user_message(user_message)
    history.add_ai_message(response)
    return lex_response(event, response.content)

def lex_response(event, message):
    return {
        "sessionState":{
            "sessionAttributes":event["sessionState"]["sessionAttributes"],
            "dialogAction":{
                "type": "ElicitIntent",
            },
            'intent': {'name': event['sessionState']['intent']['name'], 'state': 'Fulfilled'}
        },
        'messages': [
            {
                'contentType': 'PlainText',
                'content': message
            }
        ]
    }

def set_langchain_api_key():
    ssm = boto3.client('ssm')
    response = ssm.get_parameter(Name=os.environ["LANGCHAIN_API_KEY_PARAMETER_NAME"])
    os.environ["LANGCHAIN_API_KEY"] = response['Parameter']['Value']


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)
