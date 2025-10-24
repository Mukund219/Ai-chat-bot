from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import httpx
from datetime import datetime
import os
from dotenv import load_dotenv
import json
import re

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Hugging Face (use HUGGINGFACE_API_TOKEN)
# Optional: set HUGGINGFACE_MODEL in env, default is google/flan-t5-small


# In-memory storage (replace with MongoDB in production)
chat_history = {}
code_snippets = {}

# Request Models
class CodeQuery(BaseModel):
    question: str
    code_context: Optional[str] = None
    language: Optional[str] = "python"
    session_id: Optional[str] = None

class DebugRequest(BaseModel):
    error_message: str
    code_snippet: str
    language: str = "python"

class ExplainRequest(BaseModel):
    code: str
    language: str = "python"

class OptimizeRequest(BaseModel):
    code: str
    language: str = "python"

# Helper Functions
def extract_code_from_response(response: str) -> Dict:
    """Extract code blocks from AI response"""
    code_blocks = []
    pattern = r'```(\w+)?\n(.*?)```'
    matches = re.findall(pattern, response, re.DOTALL)
    
    for match in matches:
        language = match[0] if match[0] else 'plaintext'
        code = match[1].strip()
        code_blocks.append({
            'language': language,
            'code': code
        })
    
    return {
        'explanation': re.sub(pattern, '', response).strip(),
        'code_blocks': code_blocks
    }

async def get_ai_response(prompt: str, system_message: str = None) -> str:
    """Generate AI response using OpenAI"""
    messages = []
    
    if system_message:
        messages.append({"role": "system", "content": system_message})
    else:
        messages.append({
            "role": "system", 
            "content": """You are an expert programming assistant. 
            Provide clear, concise, and accurate coding help. 
            Always format code in markdown code blocks with the appropriate language tag.
            Explain your solutions step by step."""
        })
    
    messages.append({"role": "user", "content": prompt})
    
    # Use Hugging Face Inference API via httpx AsyncClient
    hf_token = os.getenv("HUGGINGFACE_API_TOKEN")
    model = os.getenv("HUGGINGFACE_MODEL", "google/flan-t5-small")

    if not hf_token:
        raise HTTPException(status_code=500, detail="Missing HUGGINGFACE_API_TOKEN environment variable")

    # Build the prompt by concatenating system_message and user prompt
    if system_message:
        full_prompt = system_message + "\n\n" + prompt
    else:
        full_prompt = prompt

    headers = {"Authorization": f"Bearer {hf_token}"}
    payload = {
        "inputs": full_prompt,
        "parameters": {"max_new_tokens": 512}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"https://api-inference.huggingface.co/models/{model}"
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

            # Handle typical HF responses
            if isinstance(data, dict) and data.get("error"):
                raise HTTPException(status_code=500, detail=f"Hugging Face Inference error: {data.get('error')}")

            # Many text-generation endpoints return a list with 'generated_text'
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "generated_text" in data[0]:
                return data[0]["generated_text"]

            # Some models return a dict with 'generated_text'
            if isinstance(data, dict) and "generated_text" in data:
                return data["generated_text"]

            # Fallback: return string representation
            return str(data)
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Hugging Face request failed: {str(e)}")

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Developer Assistant API is running!"}

@app.post("/api/ask")
async def ask_question(query: CodeQuery):
    """Handle coding questions"""
    prompt = f"Question: {query.question}"
    
    if query.code_context:
        prompt += f"\n\nCode context ({query.language}):\n```{query.language}\n{query.code_context}\n```"
    
    prompt += f"\n\nPlease provide a detailed answer with code examples in {query.language}."
    
    try:
        response = await get_ai_response(prompt)
        parsed_response = extract_code_from_response(response)
        
        # Store in history
        session_id = query.session_id or "default"
        if session_id not in chat_history:
            chat_history[session_id] = []
        
        chat_history[session_id].append({
            "timestamp": datetime.utcnow().isoformat(),
            "question": query.question,
            "response": parsed_response,
            "language": query.language
        })
        
        return {
            "success": True,
            "response": parsed_response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/debug")
async def debug_code(request: DebugRequest):
    """Debug code with error messages"""
    prompt = f"""
    Debug this {request.language} code:
    
    Error Message: {request.error_message}
    
    Code:
    ```{request.language}
    {request.code_snippet}
    ```
    
    Please:
    1. Identify the cause of the error
    2. Explain why it's happening
    3. Provide the corrected code
    4. Give tips to avoid this error in the future
    """
    
    try:
        response = await get_ai_response(prompt)
        parsed_response = extract_code_from_response(response)
        
        return {
            "success": True,
            "solution": parsed_response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/explain")
async def explain_code(request: ExplainRequest):
    """Explain how code works"""
    prompt = f"""
    Explain this {request.language} code in detail:
    
    ```{request.language}
    {request.code}
    ```
    
    Please provide:
    1. Overall purpose of the code
    2. Step-by-step explanation
    3. Time and space complexity (if applicable)
    4. Potential improvements or alternatives
    """
    
    try:
        response = await get_ai_response(prompt)
        parsed_response = extract_code_from_response(response)
        
        return {
            "success": True,
            "explanation": parsed_response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/optimize")
async def optimize_code(request: OptimizeRequest):
    """Optimize code for better performance"""
    prompt = f"""
    Optimize this {request.language} code for better performance:
    
    ```{request.language}
    {request.code}
    ```
    
    Please provide:
    1. Optimized version of the code
    2. Explanation of optimizations made
    3. Performance improvements expected
    4. Any trade-offs to consider
    """
    
    try:
        response = await get_ai_response(prompt)
        parsed_response = extract_code_from_response(response)
        
        return {
            "success": True,
            "optimization": parsed_response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/api/generate-tests")
async def generate_tests(request: ExplainRequest):
    """Generate unit tests for code"""
    prompt = f"""
    Generate comprehensive unit tests for this {request.language} code:
    
    ```{request.language}
    {request.code}
    ```
    
    Include:
    1. Normal test cases
    2. Edge cases
    3. Error cases
    4. Setup and teardown if needed
    """
    
    try:
        response = await get_ai_response(prompt)
        parsed_response = extract_code_from_response(response)
        
        return {
            "success": True,
            "tests": parsed_response,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    """Get chat history for a session"""
    history = chat_history.get(session_id, [])
    return {
        "success": True,
        "history": history[-20:]  # Last 20 conversations
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)