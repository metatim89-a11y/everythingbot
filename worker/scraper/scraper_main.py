# Version: 1.27
"""
Messenger Scraper Automation using Playwright.
Extracts messages from mbasic.facebook.com for stability.
"""

import os
import json
import time
import argparse
import re
from datetime import datetime
from playwright.sync_api import sync_playwright
import sys

# --- PATHING ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
AUTH_PATH = os.path.join(ROOT_DIR, "worker/config/fb_auth.json")

try:
    from db_handler import Database
    Database.init()
except ImportError as e:
    Database = None
    print(f"[WARNING] Local database module not found. Results will not be saved. Error: {e}")

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def extract_info(text, fields):
    """Extracts requested fields using regex from the given text."""
    results = {}
    if "email" in fields:
        emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        results["email"] = emails[0] if emails else None
    if "phone" in fields:
        phones = re.findall(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
        results["phone"] = phones[0] if phones else None
    if "address" in fields:
        # Very basic address regex (can be improved)
        address_match = re.search(r'\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Dr)', text)
        results["address"] = address_match.group(0) if address_match else None
    
    results["raw_message"] = text
    return results

def run_scraper(headed, keywords, fields, lookback_days, profile_name=None, target_url=None):
    """
    Main scraper loop. Uses Playwright and mbasic.facebook.com.
    """
    if not os.path.exists(AUTH_PATH):
        log(f"Error: Auth file not found at {AUTH_PATH}. Please login first.")
        return

    with sync_playwright() as p:
        log("Launching browser...")
        browser = p.chromium.launch(headless=not headed)
        
        # Load cookies
        with open(AUTH_PATH, "r") as f:
            cookies = json.load(f)
            
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        context.add_cookies(cookies)
        
        page = context.new_page()
        start_url = "https://mbasic.facebook.com/messages/"
        if target_url:
            start_url = target_url.replace("www.facebook.com", "mbasic.facebook.com")
            
        log(f"Navigating to target: {start_url}")
        page.goto(start_url, wait_until="domcontentloaded")
        
        if "login" in page.url:
            log("Session expired or invalid. Please login again.")
            browser.close()
            return

        # Get list of thread or post links
        if target_url:
            # Group or Page feed - look for 'Full Story' or story links
            threads = page.query_selector_all("a[href*='/story.php'], a[href*='story_fbid='], a:has-text('Full Story'), a:has-text('Comment')")
        else:
            # Messages Inbox
            threads = page.query_selector_all("a[href*='/messages/read/'], a[href*='tid=']")
            
        thread_hrefs = []
        for t in threads:
            href = t.get_attribute("href")
            if href and href not in thread_hrefs:
                thread_hrefs.append(href)
        
        log(f"Found {len(thread_hrefs)} potential threads on the first page.")

        for href in thread_hrefs:
            # Handle absolute or relative URLs
            if href.startswith("http"):
                thread_url = href
            else:
                thread_url = f"https://mbasic.facebook.com{href}"
            
            log(f"Processing thread: {thread_url}")
            page.goto(thread_url, wait_until="domcontentloaded", timeout=60000)
            
            # Improved extraction for mbasic and standard mobile layouts
            message_elements = page.query_selector_all("div#messageGroup, div[role='main'], div.msg")
            if not message_elements:
                message_elements = page.query_selector_all("span, div") # Fallback to everything
            
            thread_content = ""
            for m in message_elements:
                text = m.inner_text()
                if text and len(text) > 5: # Filter out tiny snippets
                    thread_content += text + " "
            
            # Check for keywords
            found_keywords = [kw for kw in keywords if kw.lower() in thread_content.lower()]
            
            if found_keywords or not keywords:
                log(f"Match found in thread: {thread_url}")
                extracted_data = extract_info(thread_content, fields)
                extracted_data["thread_url"] = thread_url
                extracted_data["keywords_matched"] = found_keywords
                extracted_data["profile_name"] = profile_name
                
                if Database:
                    success = Database.save_result(extracted_data, found_at=datetime.now().isoformat())
                    if success:
                        log("Result saved to database.")
                    else:
                        log("Failed to save result to database.")
                else:
                    log(f"Extracted Data: {extracted_data}")
            
            time.sleep(1) # Rate limiting

        browser.close()
        log("Scraping completed.")

def parse_args():
    parser = argparse.ArgumentParser(description="Messenger Scraper Automation")
    parser.add_argument("--headed", action="store_true", help="Show browser window")
    parser.add_argument("--keywords", type=str, help="Comma-separated keywords")
    parser.add_argument("--fields", type=str, help="Comma-separated fields")
    parser.add_argument("--lookback_days", type=int, default=0)
    parser.add_argument("--profile_name", type=str, help="Profile name that initiated the scrape")
    parser.add_argument("--target_url", type=str, help="Specific Facebook Group or Page to watch instead of Inbox")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    kws = [k.strip() for k in args.keywords.split(',')] if args.keywords else []
    flds = [f.strip() for f in args.fields.split(',')] if args.fields else ["email", "phone", "address", "raw message"]
    
    run_scraper(
        headed=args.headed,
        keywords=kws,
        fields=flds,
        lookback_days=args.lookback_days,
        profile_name=args.profile_name,
        target_url=args.target_url
    )
