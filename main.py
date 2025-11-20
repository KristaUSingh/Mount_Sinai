from fastapi import FastAPI
from routes.agent_chat import router as agent_chat_router

app = FastAPI()

app.include_router(agent_chat_router)
