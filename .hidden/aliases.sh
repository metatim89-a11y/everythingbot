#!/bin/bash
# Version: 1.00
# Project-local bash aliases and functions for everythingbot.
# Usage: source .hidden/aliases.sh

export EVERYTHINGBOT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"

function LA() {
    echo "Launching all everythingbot services with 3s staggered starts..."
    
    chmod +x "$EVERYTHINGBOT_ROOT/server/launch_mcp_server.sh"
    chmod +x "$EVERYTHINGBOT_ROOT/server/launch_nlp_service.sh"
    chmod +x "$EVERYTHINGBOT_ROOT/server/launch_web_ui.sh"

    "$EVERYTHINGBOT_ROOT/server/launch_mcp_server.sh" &
    sleep 3
    "$EVERYTHINGBOT_ROOT/server/launch_nlp_service.sh" &
    sleep 3
    "$EVERYTHINGBOT_ROOT/server/launch_web_ui.sh" &

    echo "All launch sequences triggered. Check .hidden/LOGS/ for status."
}

function KAS() {
    echo "Hard killing all everythingbot services and supervisor loops..."
    local PORTS=(3000 3001 8000)
    for port in "${PORTS[@]}"; do
        local pid=$(lsof -t -i:$port)
        if [ -n "$pid" ]; then
            echo "Killing processes on port $port (PIDs: $pid)"
            kill -9 $pid 2>/dev/null
        fi
    done

    local PROCESS_PATTERNS=("nlp_service" "react-scripts" "index.js" "uvicorn" "launch_")
    for pattern in "${PROCESS_PATTERNS[@]}"; do
        echo "Killing processes matching pattern: $pattern"
        pkill -9 -f "$pattern" 2>/dev/null
    done

    rm -f "$EVERYTHINGBOT_ROOT/.hidden/LOGS/"*_pid.txt 2>/dev/null
    echo "Cleanup complete."
}

# Virtual Environment Toggles
alias von="source \"$EVERYTHINGBOT_ROOT/.venv/bin/activate\" && echo 'Python Virtual Environment ACTIVE'"
alias voff="deactivate 2>/dev/null || true && echo 'Python Virtual Environment INACTIVE'"

echo "everythingbot local functions loaded: Type 'LA' to launch all, 'KAS' to kill all, 'von'/'voff' for venv."
