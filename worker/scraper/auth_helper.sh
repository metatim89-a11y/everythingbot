#!/bin/bash
# Version: 1.00
# Helper script to capture Facebook session cookies for the scraper.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "Activating virtual environment..."
source "$PROJECT_ROOT/.venv/bin/activate"

echo "Running credential authentication UI..."
cd "$SCRIPT_DIR" || exit 1
python3 credential_auth.py

echo "Authentication complete. Cookies saved to worker/config/fb_auth.json"
