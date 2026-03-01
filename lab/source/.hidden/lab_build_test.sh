#!/bin/bash
# Version: 1.00
# Lab Sandbox Build & Test Script

echo "--- Building and Testing Lab Sandbox ---"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LAB_DIR="$(dirname "$SCRIPT_DIR")"

echo "1. Checking syntax in /server..."
(cd "$LAB_DIR/server" && node -c index.js)
if [ $? -ne 0 ]; then
    echo "ERROR: Syntax error in MCP Server (index.js)."
    exit 1
fi

echo "2. Checking syntax in /app..."
(cd "$LAB_DIR/app" && python3 -m py_compile nlp_service.py)
if [ $? -ne 0 ]; then
    echo "ERROR: Syntax error in NLP Service (nlp_service.py)."
    exit 1
fi

echo "3. Restarting Lab Services..."
# Assuming LALAB alias or direct execution
echo "Please re-run 'LALAB' to restart the lab environment with the newly approved proposed changes."

echo "--- Build & Test Complete ---"
