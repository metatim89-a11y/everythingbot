#!/bin/bash
# Version: 1.09
# Project-local bash aliases and functions for everythingbot.
# ONE WAY IN ENFORCEMENT
# {{geminiCLI/gemini3 feb/28/26/11:40pm}}

export EVERYTHINGBOT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"
export HOST=0.0.0.0

function KAS() {
    echo "Hard killing all everythingbot services..."
    # 1. Kill by Ports
    local PORTS=(3000 3001 8000)
    for port in "${PORTS[@]}"; do
        lsof -t -i:$port | xargs -r kill -9 2>/dev/null
    done

    # 2. Kill by Process Name (Strict)
    pkill -9 -f "nlp_service" 2>/dev/null
    pkill -9 -f "react-scripts" 2>/dev/null
    pkill -9 -f "node index.js" 2>/dev/null
    pkill -9 -f "uvicorn" 2>/dev/null
    
    echo "Cleanup complete."
}

function STARTBOT() {
    echo "--- Preparing Unified Launch Sequence (The 'One Way In') ---"
    KAS
    sleep 2 # Give OS time to release ports
    if [ -z "$VIRTUAL_ENV" ]; then
        echo "Activating Python Virtual Environment..."
        source "$EVERYTHINGBOT_ROOT/.venv/bin/activate"
    fi
    bash "$EVERYTHINGBOT_ROOT/launch_all.sh"
    
    echo ""
    echo "--- Waiting for Services to Warm-up ---"
    sleep 6 # Wait for UI/GNOME to spin up
    
    # Quick health check for all pillars
    echo -e "\n--- STATUS SUMMARY ---"
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then echo -e "  [3000] MCP Server:  [\x1b[0;32mHEALTHY\x1b[0m]"; else echo -e "  [3000] MCP Server:  [\x1b[0;31mSTARTING/ERROR\x1b[0m]"; fi
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then echo -e "  [8000] NLP Service: [\x1b[0;32mHEALTHY\x1b[0m]"; else echo -e "  [8000] NLP Service: [\x1b[0;31mSTARTING/ERROR\x1b[0m]"; fi
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null; then echo -e "  [3001] Web UI:      [\x1b[0;32mHEALTHY\x1b[0m]"; else echo -e "  [3001] Web UI:      [\x1b[0;31mSTARTING/ERROR\x1b[0m]"; fi
    
    echo ""
    echo "Primary launch via launch_all.sh is complete."
    echo "Primary launch via launch_all.sh is complete."
    echo "Services are popping up in 3 independent Gnome-Terminal windows now."
    echo "Type 'kas' to stop all services."
}

# The unified launch commands:
alias startbot="STARTBOT"
alias kas="KAS"
alias viewbot="tmux attach-session -t serversessions || echo 'Bot is not running. Type \"startbot\"'"

# Individual Manual Launch Aliases (No Tmux)
alias run-mcp="echo '[A] Manual Launch: MCP Server...' && cd \"\$EVERYTHINGBOT_ROOT/server\" && node index.js 2>&1 | \"\$EVERYTHINGBOT_ROOT/color_logs.sh\""
alias run-nlp="echo '[B] Manual Launch: NLP Service...' && cd \"\$EVERYTHINGBOT_ROOT\" && source .venv/bin/activate && python3 -u -m uvicorn app.nlp_service:app --host 0.0.0.0 --port 8000 2>&1 | \"\$EVERYTHINGBOT_ROOT/color_logs.sh\""
alias run-web="echo '[C] Manual Launch: Web UI...' && cd \"\$EVERYTHINGBOT_ROOT/web\" && npm start 2>&1 | \"\$EVERYTHINGBOT_ROOT/color_logs.sh\""

# Standalone Gnome Terminal Launchers
alias launch.mcp="gnome-terminal --window --title=\"[A] MCP-SERVER\" -- bash -c \"printf '\e]11;#000000\a'; run-mcp; exec /bin/bash\" &"
alias launch.nlp="gnome-terminal --window --title=\"[B] NLP-BRAIN\" -- bash -c \"printf '\e]11;#000000\a'; run-nlp; exec /bin/bash\" &"
alias launch.npl="launch.nlp" # Fallback for typo
alias launch.web="gnome-terminal --window --title=\"[C] WEB-FACE\" -- bash -c \"printf '\e]11;#000000\a'; run-web; exec /bin/bash\" &"

# Virtual Environment Toggles
alias von="source \"$EVERYTHINGBOT_ROOT/.venv/bin/activate\" && echo 'Python Virtual Environment ACTIVE'"
alias voff="deactivate 2>/dev/null || true && echo 'Python Virtual Environment INACTIVE'"

echo "everythingbot local functions loaded: Type 'startbot' to launch in One-Way-In mode."
