#!/bin/bash
# Version: 1.00
# Helper script to run the Playwright Facebook Scraper.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "Activating virtual environment..."
source "$PROJECT_ROOT/.venv/bin/activate"

cd "$SCRIPT_DIR" || exit 1

# Default keywords if none provided
KEYWORDS="${1:-delivery,address,firewood,cord,location,street,drop,cash}"

echo "Starting Scraper with keywords: $KEYWORDS"
python3 scraper_main.py --keywords="$KEYWORDS"
