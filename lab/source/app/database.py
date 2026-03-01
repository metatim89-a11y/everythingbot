# Version: 1.01
"""
Database schema and interaction logic for bot memory.
Inputs: User interaction data.
Outputs: Persisted log entries in SQLite.
Purpose: To provide a memory layer for the bot to learn from past interactions.
"""
import sqlite3
import os

# Use relative path for the database
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'training.db')

def init_db():
    """Initializes the database schema if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS bot_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_input TEXT,
            bot_response TEXT,
            event TEXT
        )
    ''')
    # Table for training data as seen in bot_control_window_nlp_teach.py
    c.execute('''
        CREATE TABLE IF NOT EXISTS training_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def log_interaction(user_input, bot_response, event=None):
    """Logs a single interaction to the database."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO bot_log (user_input, bot_response, event)
        VALUES (?, ?, ?)
    ''', (user_input, bot_response, event))
    conn.commit()
    conn.close()

def get_history(limit=50):
    """Retrieves the last N interactions from the log."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        SELECT timestamp, user_input, bot_response, event FROM bot_log ORDER BY id DESC LIMIT ?
    ''', (limit,))
    rows = c.fetchall()
    conn.close()
    return rows

if __name__ == '__main__':
    init_db()
    print(f'Bot memory database initialized at {DB_PATH}')

# (Made by: Gemini CLI)
