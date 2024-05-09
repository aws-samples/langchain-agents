
import boto3
import os
import json

boto3_session = boto3.session.Session()
region_name = boto3_session.region_name
client = boto3_session.client('bedrock-agent', region_name=region_name)

def lambda_handler(event, context):
    start_job_response = client.start_ingestion_job(knowledgeBaseId = os.environ["KNOWLEDGE_BASE_ID"], dataSourceId = os.environ["DATA_SOURCE_ID"])
    return json.dumps(start_job_response["ingestionJob"])