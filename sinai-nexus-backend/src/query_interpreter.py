# -------------------------------------------------------------
# query_interpreter.py
# -------------------------------------------------------------
# Uses Gemini to interpret a user's natural-language scheduling
# question and convert it into structured intent + fields.
# -------------------------------------------------------------

from dotenv import load_dotenv
import os

import re, json
import google.generativeai as genai

load_dotenv()
google_api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=google_api_key)

def interpret_scheduling_query(user_question: str):
    """
    Purpose:
        Convert a natural language question (e.g. "Where is CT Head done?")
        into a structured JSON object describing intent and key entities.

    Output example:
        {
          "intent": "exam_at_site",
          "exam": "CT HEAD WO IV CONTRAST",
          "site": "1176 5TH AVE RAD CT"
        }

    Possible intents:
        • exam_at_site        → asks if an exam is done at a given site
        • locations_for_exam  → asks which sites perform an exam
        • exams_at_site       → asks which exams a site performs
    """
    prompt = f"""
    You are a medical scheduling assistant. The user asked:

    "{user_question}"

    Identify the user's intent and extract:
      - "exam" (the test/procedure name, if mentioned)
      - "site" (the location/department, if mentioned)
    Possible intents:
      1. "exam_at_site"       → user asks if an exam is performed at a given site
      2. "locations_for_exam" → user asks which sites perform a certain exam
      3. "exams_at_site"      → user asks what exams are offered at a site
      4. "exam_duration"      → user asks how long an exam or visit takes 
                                (based on 'Visit Type Length' in minutes)
      5. "rooms_for_exam_at_site" → user asks which rooms at a specific site perform a specific exam
      6. "rooms_for_exam" → when the user asks which rooms perform an exam, without specifying a site.

    Respond *only* as compact JSON:
    {{
      "intent": "...",
      "exam": "...",
      "site": "..."
    }}
    """

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)
    text = response.text or ""

    # Extract JSON safely
    match = re.search(r'\{.*\}', text, re.S)
    if not match:
        return {"intent": None, "exam": None, "site": None}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {"intent": None, "exam": None, "site": None}