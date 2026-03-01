#!/bin/bash
# Version: 1.00
# Helper script to watch the live output of all three services in a single terminal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "Tailing all active logs for everythingbot. Press Ctrl+C to stop."
echo "================================================================="

tail -f \
    "$SCRIPT_DIR/.hidden/LOGS/web_ui/out/web_ui_stdout.log" \
    "$SCRIPT_DIR/.hidden/LOGS/mcp_server/out/mcp_server_stdout.log" \
    "$SCRIPT_DIR/.hidden/LOGS/nlp_service/out/nlp_service_stdout.log"
