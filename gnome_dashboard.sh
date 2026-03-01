#!/bin/bash
# Version: 1.10
# everythingbot GNOME Direct Launcher (Professional Tab Grouping)
# {{geminiCLI/gemini3 feb/28/26/4:50pm}}

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Define commands with absolute paths and color pipes
CMD_MCP="echo '[A] MCP (NODEJS) - STARTING...'; cd '$PROJECT_ROOT/server' && /usr/bin/node index.js 2>&1 | $PROJECT_ROOT/color_logs.sh; echo '!!! MCP EXITED !!!'; exec /bin/bash"
CMD_NLP="echo '[B] NLP (PYTHON) - STARTING...'; cd '$PROJECT_ROOT' && source '$PROJECT_ROOT/.venv/bin/activate' && python3 -u -m uvicorn app.nlp_service:app --host 0.0.0.0 --port 8000 2>&1 | $PROJECT_ROOT/color_logs.sh; echo '!!! NLP EXITED !!!'; exec /bin/bash"
CMD_WEB="echo '[C] WEB (REACT) - STARTING...'; cd '$PROJECT_ROOT/web' && /usr/bin/npm start 2>&1 | $PROJECT_ROOT/color_logs.sh; echo '!!! WEB EXITED !!!'; exec /bin/bash"

echo "Spawning professional GNOME dashboard window with 3 attached service tabs..."

# The single most reliable way to group tabs in one new window
gnome-terminal --window --title="everythingbot-OS" \
  --tab --title="[A] MCP-SERVER" -- bash -c "$CMD_MCP" \
  --tab --title="[B] NLP-BRAIN" -- bash -c "$CMD_NLP" \
  --tab --title="[C] WEB-FACE" -- bash -c "$CMD_WEB"

echo "Dashboard spawned. All services are running in the foreground of their tabs."
