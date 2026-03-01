#!/bin/bash
# Version: 1.04

# Ensure we operate from the root of the project
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"
cd "$PROJECT_ROOT" || { echo "ERROR: Could not find project root."; exit 1; }

TARGET_DIR="."
DEST_DIR="./.hidden/snapshots"
MODE="nobigies" # default

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --nobigies) MODE="nobigies" ;;
        --biggies) MODE="biggies" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift # shift to the next argument
done

if [ ! -d "$DEST_DIR" ]; then
    echo "Creating directory: $DEST_DIR..."
    mkdir -p "$DEST_DIR"
fi

if [ "$MODE" = "nobigies" ]; then
    OUTPUT_FILE="${DEST_DIR}/everythingbot_nobigies.tar.gz"
    echo "--- Initializing NO-BIGGIES Tar Snapshot ---"
    
    # Calculate file count for progress bar
    echo "Calculating file count..."
    TOTAL_FILES=$(find "$TARGET_DIR" -type f | grep -v "/\.hidden" | grep -v "/\.venv" | grep -v "/models/.*\.gguf" | grep -v "/node_modules" | grep -v "/\.git" | grep -v "/__pycache__" | wc -l)
    
    tar -cvf - \
        --exclude="./.hidden" \
        --exclude="./.venv" \
        --exclude="./models/*.gguf" \
        --exclude="*/node_modules" \
        --exclude="./.git" \
        --exclude="*/__pycache__" \
        "$TARGET_DIR" .gitignore 2>/dev/null | awk -v total="$TOTAL_FILES" '
    {
        count++
        percent = (count/total)*100
        printf "\rArchiving: [%-50s] %3.1f%% (%d/%d files)", substr("==================================================", 1, int(percent/2)), percent, count, total
    }
    END { print "\rArchiving: [==================================================] 100%   Done!        " }
    ' | gzip > "$OUTPUT_FILE"

else
    OUTPUT_FILE="${DEST_DIR}/everythingbot_biggies.tar.gz"
    echo "--- Initializing BIGGIES Tar Snapshot ---"
    
    echo "Calculating file count (this might take a few moments for Biggies)..."
    TOTAL_FILES=$(find "$TARGET_DIR" -type f | grep -v "/\.hidden" | wc -l)
    
    tar -cvf - \
        --exclude="./.hidden" "$TARGET_DIR" .gitignore 2>/dev/null | awk -v total="$TOTAL_FILES" '
    {
        count++
        percent = (count/total)*100
        printf "\rArchiving: [%-50s] %3.1f%% (%d/%d files)", substr("==================================================", 1, int(percent/2)), percent, count, total
    }
    END { print "\n\rArchiving: [==================================================] 100%   Done!        " }
    ' | gzip > "$OUTPUT_FILE"
fi

echo "Tar snapshot saved to: $OUTPUT_FILE"
