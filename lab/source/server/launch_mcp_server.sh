#!/bin/bash

# Version: 1.15

SERVICE_NAME="MCP Server"
PORT=3000
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_ROOT/.hidden/LOGS/mcp_server/out"
ERR_DIR="$PROJECT_ROOT/.hidden/LOGS/mcp_server/err"

log_event() {
    local level=$1
    local message=$2
    local timestamp=$(date +'%Y-%m-%dT%H:%M:%S%z')
    local sig_date=$(date +'%b/%d/%y/%I:%M%p' | tr '[:upper:]' '[:lower:]')
    echo "[$timestamp] [$level] [$SERVICE_NAME] $message {{geminiCLI/5idesFi5ales $sig_date}}"
}

mkdir -p "$OUT_DIR" "$ERR_DIR"

# --- SINGLETON ENFORCEMENT ---
pkill -9 -f "node index.js" 2>/dev/null
lsof -t -i:$PORT | xargs -r kill -9 2>/dev/null
sleep 1

log_event "INFO" "Starting $SERVICE_NAME."

(cd $PROJECT_ROOT/server && node index.js) 1>> "$OUT_DIR/mcp_server_stdout.log" 2>> "$ERR_DIR/mcp_server_stderr.log" &

echo "Performing health check..."
for i in {1..10}; do
    if curl -sSf http://localhost:3000/health > /dev/null 2>&1; then
        log_event "INFO" "$SERVICE_NAME is HEALTHY and listening on port $PORT."
        log_event "INFO" "Executing techstack training payload (teach_bot.py)..."
        python3 /home/tim/projects/everythingbot/teach_bot.py &
        exit 0
    fi
    sleep 2
done

log_event "ERROR" "$SERVICE_NAME failed health check."
exit 1

# (Made by: Gemini CLI)
{{geminiCLI/5idesFi5ales feb/20/26/5:35am}}
