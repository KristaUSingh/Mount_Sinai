from fastapi import APIRouter
from pydantic import BaseModel

# Import Gaurav’s pipeline
from src.query_router import answer_scheduling_query   # ← the main backend function that returns room/time/etc.

router = APIRouter()

class ChatInput(BaseModel):
    question: str

@router.post("/agent-chat")
def agent_chat(input: ChatInput):
    user_question = input.question
    
    try:
        # Run Gaurav’s code
        answer = answer_scheduling_query(user_question)
        return {"answer": answer}
    
    except Exception as e:
        return {"answer": f"Sorry, I couldn't process that: {str(e)}"}
