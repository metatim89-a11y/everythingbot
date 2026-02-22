# Version: 1.30
"""
NLP Service for everythingbot.
Highly verbose "Belly" logging with mandatory signatures.
"""
import os
import sys
import json
from datetime import datetime
import logging
import requests
from fastapi import FastAPI, Request
from pydantic import BaseModel

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
sys.path.insert(0, SCRIPT_DIR)

from database import init_db

# --- Mandatory Signature Logic ---
def get_signature():
    """Generates the mandatory user-requested signature."""
    now = datetime.now()
    # Format: feb/20/26/4:30am
    sig_date = now.strftime('%b/%d/%y/%I:%M%p').lower()
    return f"{{{{geminiCLI/gemini3 {sig_date}}}}}"

class SignedFormatter(logging.Formatter):
    """Custom formatter to append signature to every log line."""
    def format(self, record):
        record.msg = f"{record.msg} {get_signature()}"
        return super().format(record)

LOG_DIR = os.path.join(ROOT_DIR, '.hidden', 'LOGS', 'nlp_service')
os.makedirs(os.path.join(LOG_DIR, 'out'), exist_ok=True)
os.makedirs(os.path.join(LOG_DIR, 'err'), exist_ok=True)

# Belly Logging Configuration
logger = logging.getLogger("nlp_belly")
logger.setLevel(logging.DEBUG)

# Standard Output Handler
stdout_handler = logging.StreamHandler(sys.stdout)
stdout_handler.setFormatter(SignedFormatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(stdout_handler)

# File Handler
file_handler = logging.FileHandler(os.path.join(LOG_DIR, 'out', 'nlp_service_stdout.log'))
file_handler.setFormatter(SignedFormatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

MCP_SERVER_URL = "http://localhost:3000"

def get_remote_config():
    """Fetch real-time settings from MCP server."""
    try:
        res = requests.get(f"{MCP_SERVER_URL}/config", timeout=1.0)
        return res.json()
    except Exception as e:
        logger.error(f"CONFIG_ERROR: Could not fetch remote config: {e}")
        return {"max_new_tokens": 128, "temperature": 0.7}

def log_to_mcp(level, message, details=None):
    """Verbose internal trace for MCP logging."""
    logger.debug(f"Entering log_to_mcp: {level} - {message}")
    try:
        requests.post(f"{MCP_SERVER_URL}/log", json={
            "source": "NLP_SERVICE", 
            "level": level, 
            "message": message, 
            "details": details or {}
        }, timeout=0.5)
    except Exception as e:
        logger.error(f"MCP Logging failed: {e}")

app = FastAPI()
ai_nlp_pipeline = None
active_model_info = {"name": "None", "task": "None"}

def initialize_nlp_pipeline():
    """Deep belly trace of model initialization."""
    global ai_nlp_pipeline, active_model_info
    logger.info("INIT: Starting NLP pipeline initialization.")
    
    if ai_nlp_pipeline:
        logger.info("INIT: Pipeline already exists, skipping.")
        return

    try:
        from transformers import pipeline
        model_id = os.getenv("NLP_MODEL", "microsoft/phi-1_5")
        logger.debug(f"INIT: Loading model ID: {model_id}")
        
        # Fixing the 'broken state' by explicitly avoiding max_length conflict
        ai_nlp_pipeline = pipeline('text-generation', model=model_id, trust_remote_code=True)
        active_model_info = {"name": model_id.split('/')[-1], "task": "text-generation"}
        
        logger.info(f"INIT: NLP Loaded successfully: {active_model_info['name']}")
    except Exception as e:
        logger.error(f"INIT_FATAL: NLP Load Error: {e}")

@app.on_event("startup")
async def startup_event():
    """Belly trace of FastAPI startup."""
    logger.debug("STARTUP: Triggering init_db and pipeline load.")
    init_db()
    initialize_nlp_pipeline()

class ChatRequest(BaseModel):
    message: str
    session_id: int = None

@app.post("/chat")
async def chat(request: ChatRequest):
    """Ultra-verbose chat processing trace."""
    logger.info(f"CHAT_IN: Received message for session {request.session_id}")
    logger.debug(f"CHAT_IN_RAW: '{request.message}'")
    
    if not ai_nlp_pipeline:
        logger.error("CHAT_ERROR: AI model not initialized.")
        return {"response": "AI not loaded."}

    # Fetch real-time config
    config = get_remote_config()
    max_tokens = config.get("max_new_tokens", 128)
    temp = config.get("temperature", 0.7)
    logger.debug(f"CHAT_CONFIG: Using max_tokens={max_tokens}, temp={temp}")

    try:
        # Improved formatting for Phi-1.5 Instruct
        system_msg = "A chat between a curious user and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the user's questions."
        prompt = f"{system_msg}\nUser: {request.message}\nAssistant:"
        logger.debug(f"CHAT_PROMPT: {prompt}")
        
        outputs = ai_nlp_pipeline(
            prompt, 
            max_new_tokens=max_tokens, 
            max_length=None,
            temperature=temp, 
            do_sample=True, 
            pad_token_id=50256
        )
        
        response = outputs[0]['generated_text'].replace(prompt, "").strip()
        # Clean up any trailing User/Assistant labels
        response = response.split("User:")[0].split("Assistant:")[0].strip()
        
        logger.info(f"CHAT_OUT: Response generated ({len(response)} chars)")
        logger.debug(f"CHAT_OUT_RAW: '{response}'")
        
        return {"response": response}
    except Exception as e:
        logger.error(f"CHAT_FATAL: Generation failed: {e}")
        return {"response": f"Error: {e}"}

if __name__ == '__main__':
    logger.info("MAIN: NLP Service executed as script.")



