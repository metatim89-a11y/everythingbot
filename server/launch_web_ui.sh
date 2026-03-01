#!/bin/bash

# Version: 1.15

SERVICE_NAME="Web UI"
PORT=3001
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_ROOT/.hidden/LOGS/web_ui/out"
ERR_DIR="$PROJECT_ROOT/.hidden/LOGS/web_ui/err"

log_event() {
    local level=$1
    local message=$2
    local timestamp=$(date +'%Y-%m-%dT%H:%M:%S%z')
    local sig_date=$(date +'%b/%d/%y/%I:%M%P' | tr '[:upper:]' '[:lower:]')
    echo "[$timestamp] [$level] [$SERVICE_NAME] $message {{geminiCLI/5idesFi5ales $sig_date}}"
}

mkdir -p "$OUT_DIR" "$ERR_DIR"

# --- SINGLETON ENFORCEMENT ---
log_event "INFO" "Cleaning up previous $SERVICE_NAME instances..."
pkill -9 -f "react-scripts start" 2>/dev/null
lsof -t -i:$PORT | xargs -r kill -9 2>/dev/null
sleep 1

log_event "INFO" "Starting $SERVICE_NAME Singleton Supervisor (PORT: $PORT)."

# Add BROWSER=none to prevent it from trying to open a browser window automatically
# In background mode, use CI=true for stability and proper decoupling
(cd $PROJECT_ROOT/web && export BROWSER=none && export CI=true && nohup npm start 1>> "$OUT_DIR/web_ui_stdout.log" 2>> "$ERR_DIR/web_ui_stderr.log" < /dev/null &)

echo "Performing port check (waiting up to 120s)..."
for i in {1..40}; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        log_event "INFO" "$SERVICE_NAME is UP and listening on port $PORT."
        exit 0
    fi
    sleep 3
done

log_event "ERROR" "$SERVICE_NAME failed to start on port $PORT within 120 seconds. Check $OUT_DIR/web_ui_stdout.log for errors."
exit 1

# (Made by: Gemini CLI)
{{geminiCLI/5idesFi5ales feb/20/26/6:25am}}
