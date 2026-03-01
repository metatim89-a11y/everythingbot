#!/bin/bash
# Version: 1.09
# everythingbot Unified Launch Script (The "One Way In")
# {{geminiCLI/gemini3 feb/28/26/10:50pm}}

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "Performing Hard Reset (KAS) and consolidating entry points..."

# Kill old tmux sessions to prevent "ghost" services
tmux kill-session -t serversessions 2>/dev/null

# Clean up all 3 ports
PORTS=(3000 3001 8000)
for port in "${PORTS[@]}"; do
    pid=$(lsof -t -i:$port)
    if [ -n "$pid" ]; then
        kill -9 $pid 2>/dev/null
    fi
done

# Launch the tmux-based windowed dashboard script
bash "$PROJECT_ROOT/status_dashboard.sh"
