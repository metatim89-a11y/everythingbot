#!/bin/bash
# Version: 1.08
# everythingbot Status Dashboard (tmux + File Error Logging)
# {{geminiCLI/gemini3 feb/28/26/11:58pm}}

SESSION="serversessions"
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="$PROJECT_ROOT/.hidden/LOGS"

# Ensure log directories exist
mkdir -p "$LOG_DIR"

# Kill existing session if it exists to refresh
tmux kill-session -t $SESSION 2>/dev/null

# Foreground commands. Using `tee` on stderr so errors show on screen AND save to log file.
# stdout goes through the colorizer, stderr goes to the log file + screen
CMD_MCP="echo '[A] STARTING MCP SERVER (NODE)...'; cd '$PROJECT_ROOT/server' && /usr/bin/node index.js 2> >(tee -a '$LOG_DIR/mcp_server_stderr.log' >&2) | $PROJECT_ROOT/color_logs.sh; echo '!!! MCP EXITED !!!'; exec /bin/bash"
CMD_NLP="echo '[B] STARTING NLP BRAIN (PYTHON)...'; cd '$PROJECT_ROOT' && source '$PROJECT_ROOT/.venv/bin/activate' && python3 -u -m uvicorn app.nlp_service:app --host 0.0.0.0 --port 8000 2> >(tee -a '$LOG_DIR/nlp_service_stderr.log' >&2) | $PROJECT_ROOT/color_logs.sh; echo '!!! NLP EXITED !!!'; exec /bin/bash"
CMD_WEB="echo '[C] STARTING WEB FRONTEND (REACT)...'; cd '$PROJECT_ROOT/web' && /usr/bin/npm start 2> >(tee -a '$LOG_DIR/web_ui_stderr.log' >&2) | $PROJECT_ROOT/color_logs.sh; echo '!!! WEB EXITED !!!'; exec /bin/bash"

echo "Spawning a single Gnome-Terminal window with 3 tabs..."

gnome-terminal --window --title="serversessions" \
    --tab --title="[A] MCP-SERVER" -- bash -c "printf '\e]11;#000000\a'; $CMD_MCP" \
    --tab --title="[B] NLP-BRAIN" -- bash -c "printf '\e]11;#000000\a'; $CMD_NLP" \
    --tab --title="[C] WEB-FACE" -- bash -c "printf '\e]11;#000000\a'; $CMD_WEB" &

echo "Done! The servers are now running in 3 tabs in a single window."
