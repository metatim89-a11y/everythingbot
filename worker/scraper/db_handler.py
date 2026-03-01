# Version: 1.00
"""
Database helper for the Worker Pillar Scraper.
Manages the SQLite connection to data/scraper_results.db
"""
import sqlite3
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Root relative to worker/scraper -> worker -> everythingbot
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../../"))
DB_PATH = os.path.join(ROOT_DIR, "data/scraper_results.db")

class Database:
    @staticmethod
    def init():
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS scraper_results (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        profile_name TEXT,
                        email TEXT,
                        phone TEXT,
                        address TEXT,
                        raw_message TEXT,
                        thread_url TEXT,
                        keywords_matched TEXT,
                        found_at TEXT
                    )
                """)
                conn.commit()
                print(f"[DB] Initialized database at {DB_PATH}")
        except Exception as e:
            print(f"[DB ERROR] Failed to initialize DB: {e}")

    @staticmethod
    def save_result(data, found_at):
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO scraper_results 
                    (profile_name, email, phone, address, raw_message, thread_url, keywords_matched, found_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    data.get("profile_name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("address"),
                    data.get("raw_message"),
                    data.get("thread_url"),
                    str(data.get("keywords_matched", [])),
                    found_at
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[DB ERROR] Failed to save result: {e}")
            return False
