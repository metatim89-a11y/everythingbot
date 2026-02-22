#!/bin/bash
# Version: 1.03

# Ensure we operate from the root of the project
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." &> /dev/null && pwd )"
cd "$PROJECT_ROOT" || { echo "ERROR: Could not find project root."; exit 1; }

TARGET_DIR="."
DEST_DIR="./.hidden/snapshots"
MODE="full" # default

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --fullsnapshot) MODE="full" ;;
        --ssfast) MODE="fast" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift # shift to the next argument
done

if [ ! -d "$DEST_DIR" ]; then
    echo "Creating directory: $DEST_DIR..."
    mkdir -p "$DEST_DIR"
fi

if [ "$MODE" = "fast" ]; then
    OUTPUT_FILE="${DEST_DIR}/everythingbot_fast.tar.gz"
    echo "--- Initializing FAST Tar Snapshot ---"
    # Fast snapshot excludes heavy folders and hidden trunks
    tar -czvf "$OUTPUT_FILE" \
        --exclude="./.hidden" \
        --exclude="*/node_modules*" \
        --exclude="*/.venv*" \
        --exclude="./.git" "$TARGET_DIR" .gitignore
else
    OUTPUT_FILE="${DEST_DIR}/everythingbot_full.tar.gz"
    echo "--- Initializing FULL Tar Snapshot ---"
    # Full snapshot backs up EVERYTHING (except the .hidden trunk containing logs and previous snapshots)
    tar -czvf "$OUTPUT_FILE" \
        --exclude="./.hidden" "$TARGET_DIR" .gitignore
fi

echo "Tar snapshot saved to: $OUTPUT_FILE"
