# Version: 1.01
# Location: lab/utils/vault_cloaking.py
# {{geminiCLI/gemini3 feb/28/26/11:55pm}}

import os
import hashlib

def get_cloaked_path(username):
    # Create a unique hash for the user to hide their identity in the terminal
    user_hash = hashlib.sha256(username.encode()).hexdigest()[:12]
    # Store it in a path that looks like system overhead
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(project_root, "lab", ".sys_cache", f"node_m_0x{user_hash}")

def create_dark_vault(username):
    target_path = get_cloaked_path(username)
    
    if not os.path.exists(target_path):
        os.makedirs(target_path)
        # Creating a file that looks like a binary library instead of a DB
        db_fake_name = "runtime.lib.so.db"
        print(f"Cloaked vault initialized at: {target_path}")
    else:
        print("Vault exists. Accessing via hash.")

# Testing the cloak
if __name__ == "__main__":
    create_dark_vault("test_user_5ide")
