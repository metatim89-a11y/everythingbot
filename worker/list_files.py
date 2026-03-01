from huggingface_hub import HfApi

# Version 1.06
api = HfApi()
try:
    files = api.list_repo_files("RichardErkhov/microsoft_-_phi-1_5-gguf")
    for f in files:
        if "q4_k_m" in f.lower():
            print(f"FOUND: {f}")
except Exception as e:
    print(e)
