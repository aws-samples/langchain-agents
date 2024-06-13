from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Config:
    CONVERSATION_TABLE_NAME = os.environ['CONVERSATION_TABLE_NAME']
    CHAT_INDEX_TABLE_NAME = os.environ['CHAT_INDEX_TABLE_NAME']

config = Config()
