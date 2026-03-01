#!/bin/bash

# Version: 1.17

SERVICE_NAME="NLP Service"
PORT=8000
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_ROOT/.hidden/LOGS/nlp_service/out"
ERR_DIR="$PROJECT_ROOT/.hidden/LOGS/nlp_service/err"

log_event() {
    local level=$1
    local message=$2
    local timestamp=$(date +'%Y-%m-%dT%H:%M:%S%z')
    local sig_date=$(date +'%b/%d/%y/%I:%M%p' | tr '[:upper:]' '[:lower:]')
    echo "[$timestamp] [$level] [$SERVICE_NAME] $message {{geminiCLI/5idesFi5ales $sig_date}}"
}

mkdir -p "$OUT_DIR" "$ERR_DIR"

# --- SINGLETON ENFORCEMENT ---
pkill -9 -f "app.nlp_service:app" 2>/dev/null
lsof -t -i:$PORT | xargs -r kill -9 2>/dev/null
sleep 1

log_event "INFO" "Starting $SERVICE_NAME Singleton Supervisor."

(cd $PROJECT_ROOT && while true; do 
    $PROJECT_ROOT/.venv/bin/python3 -m uvicorn app.nlp_service:app --host 0.0.0.0 --port $PORT;
    sleep 5;
done) 1>> "$OUT_DIR/nlp_service_stdout.log" 2>> "$ERR_DIR/nlp_service_stderr.log" &

echo "Performing port check..."
for i in {1..20}; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        log_event "INFO" "$SERVICE_NAME is UP and listening on port $PORT."
        exit 0
    fi
    sleep 3
done

log_event "ERROR" "$SERVICE_NAME failed to start on port $PORT."
exit 1

# (Made by: Gemini CLI)
{{geminiCLI/5idesFi5ales feb/20/26/5:37am}}
