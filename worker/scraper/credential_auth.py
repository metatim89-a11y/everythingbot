# Version: 1.01
"""
Manual authentication script to capture Facebook session cookies using Playwright.
"""

import os
import json
import time
from playwright.sync_api import sync_playwright

# --- PATHING ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
AUTH_PATH = os.path.join(ROOT_DIR, "worker/config/fb_auth.json")

def capture_cookies():
    """
    Opens a headed browser for the user to login to Facebook,
    then saves the captured cookies to fb_auth.json.
    """
    with sync_playwright() as p:
        print("Launching browser for manual login...")
        browser = p.chromium.launch(headless=False)
        # Use a standard User-Agent to avoid immediate abortion/blocks
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        try:
            print("Navigating to Facebook...")
            page.goto("https://www.facebook.com", timeout=60000, wait_until="domcontentloaded")
        except Exception as e:
            print(f"Initial navigation failed: {e}. Retrying with mbasic...")
            page.goto("https://mbasic.facebook.com", timeout=60000, wait_until="domcontentloaded")
        
        print("\n" + "="*50)
        print("PLEASE LOGIN TO FACEBOOK IN THE OPENED BROWSER.")
        print("Once you are logged in and see your feed, return here.")
        print("="*50 + "\n")
        
        input("Press Enter here AFTER you have successfully logged in...")
        
        cookies = context.cookies()
        
        # Filter for essential cookies if needed, or save all
        os.makedirs(os.path.dirname(AUTH_PATH), exist_ok=True)
        with open(AUTH_PATH, "w") as f:
            json.dump(cookies, f, indent=2)
            
        print(f"\n✅ Successfully saved {len(cookies)} cookies to {AUTH_PATH}")
        browser.close()

if __name__ == "__main__":
    capture_cookies()
