#!/bin/bash

# Version: 1.15

SERVICE_NAME="Web UI"
PORT=3001
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"
OUT_DIR="$PROJECT_ROOT/LOGS/web_ui/out"
ERR_DIR="$PROJECT_ROOT/LOGS/web_ui/err"

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
if command -v gnome-terminal >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    gnome-terminal --tab --title="everythingbot $SERVICE_NAME" -- bash -c "
        (cd $PROJECT_ROOT/web && export BROWSER=none && PORT=$PORT npm run start) 2> >(tee -a $ERR_DIR/web_ui_stderr.log) | tee -a $OUT_DIR/web_ui_stdout.log;
        echo '----------------------------------------';
        echo '$SERVICE_NAME process has stopped.';
        echo 'Check LOGS/web_ui/ for details.';
        echo 'Press ENTER to close this tab...';
        read
    "
else
    # In background mode, use nohup and ensure BROWSER=none
    (cd $PROJECT_ROOT/web && export BROWSER=none && PORT=$PORT nohup npm run start) 1>> $OUT_DIR/web_ui_stdout.log 2>> $ERR_DIR/web_ui_stderr.log &
fi

echo "Performing port check..."
for i in {1..20}; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
        log_event "INFO" "$SERVICE_NAME is UP and listening on port $PORT."
        exit 0
    fi
    sleep 3
done

log_event "ERROR" "$SERVICE_NAME failed to start on port $PORT within 60 seconds."
exit 1

# (Made by: Gemini CLI)
{{geminiCLI/5idesFi5ales feb/20/26/6:25am}}
