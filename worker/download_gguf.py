import os
from huggingface_hub import hf_hub_download, HfApi
import shutil

# Version: 1.07
print("Starting download of Phi-1.5 Q4_K_M GGUF model from RichardErkhov...")
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, '..'))
models_dir = os.path.join(project_root, 'models')

os.makedirs(models_dir, exist_ok=True)

repo_id = "RichardErkhov/microsoft_-_phi-1_5-gguf"
target_file = "phi-1_5.Q4_K_M.gguf"

print(f"Target file: {target_file}")

try:
    model_path = hf_hub_download(
        repo_id=repo_id,
        filename=target_file,
        local_dir=models_dir,
    )
    print(f"Download complete! Model saved to: {model_path}")
    
except Exception as e:
    print(f"Error during download: {e}")

# (Made by: Gemini CLI)
