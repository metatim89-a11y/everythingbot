#!/bin/bash
# Version: 1.03
# Log Colorizer for everythingbot Status Dashboard
# {{geminiCLI/gemini3 feb/28/26/11:45pm}}

# ANSI Color Codes
G='\x1b[0;32m' # Green (GET / Requests / Healthy)
W='\x1b[1;37m' # White (API / Call / Parse)
R='\x1b[0;31m' # Red (Errors)
Y='\x1b[1;33m' # Yellow (POST / Warnings)
NC='\x1b[0m'    # No Color

# Use sed for high-performance stream coloring
# Priority: 1. Red (Errors) -> 2. Yellow (POST) -> 3. Green (GET/Traffic) -> 4. White (API/Parse)
stdbuf -oL sed -u \
    -e "s/.*\(ERROR\|failed\|fail\|FAILED\|FAIL\).*/${R}&${NC}/i" \
    -e "t" \
    -e "s/.*\(POST\|CHAT_IN\).*/${Y}&${NC}/i" \
    -e "t" \
    -e "s/.*\(GET\|Incoming\|Finished\|INCOMING\|FINISHED\|HEALTHY\|UP\).*/${G}&${NC}/i" \
    -e "t" \
    -e "s/.*\(API\|CALL\|PARSE\|parses\).*/${W}&${NC}/i"
