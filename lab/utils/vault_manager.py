# Version: 1.00
# Location: lab/utils/vault_manager.py
# {{geminiCLI/gemini3 feb/28/26/11:30pm}}

import os
import sqlite3

def create_user_vault(username):
    # Enforce hidden directory status in the lab pillar
    # We execute this inside the project root via Debial WSL environment
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    vault_path = os.path.join(project_root, "lab", "users", f".{username}_vault")
    
    if not os.path.exists(vault_path):
        os.makedirs(vault_path)
        print(f"Vault created for {username}")
        
        # Initialize the isolated SQLite DB for UI/Button customization
        conn = sqlite3.connect(os.path.join(vault_path, "user_config.sqlite"))
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS preferences 
                          (key TEXT PRIMARY KEY, value TEXT)''')
        conn.commit()
        conn.close()
    else:
        print("Vault already exists. Maintaining isolation.")

# One Objective at a Time: Initialize a test vault
if __name__ == "__main__":
    create_user_vault("test_user_5ide")
