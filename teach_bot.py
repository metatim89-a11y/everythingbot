import sys
import json
import urllib.request

AI_ONLY_TOKEN = "e89b3f94-7a1a-4f5c-8d2b-6c4e1f7a8b9c"
url = "http://localhost:3000/ai-only/teach"
data = {
    "topic": "React Server Components & Memoization",
    "concept_description": "When generating React UI code, you must prioritize separation of concerns between Server Components (data fetching) and Client Components (interactivity). Heavily utilize useMemo, useCallback, and React.memo to prevent unnecessary re-renders in deep component trees.",
    "code_example": "const ExpensiveTree = React.memo(({ data }) => ( <div/> ));"
}

headers = {
    'Content-Type': 'application/json',
    'x-ai-only-token': AI_ONLY_TOKEN
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)

try:
    with urllib.request.urlopen(req) as response:
        result = response.read().decode('utf-8')
        print(f"SUCCESS: {result}")
        sys.exit(0)
except Exception as e:
    print(f"FAILED: {e}")
    sys.exit(1)
