# Developer Assistant Backend — local setup

This project uses a `.env` file for local configuration. The repository should never contain real API keys or other secrets.

What I changed

- Removed the real OpenAI API key from `backend/.env` and left an empty placeholder.
- Added `backend/.env.example` with placeholder values.
- Added a top-level `.gitignore` entry to ignore `backend/.env`.

Quick local steps (PowerShell)

1. Create a virtual environment (recommended):

```powershell
cd d:\academics\developer-assistant\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Provide your API key locally in one of these ways (OpenAI or Hugging Face):

- Option A (OpenAI, recommended for quick testing): set it in the environment for the current session (PowerShell):

```powershell
$env:OPENAI_API_KEY = 'sk-REPLACE-WITH-YOUR-KEY'
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

- Option B (Hugging Face): set HF token in the environment for the current session (PowerShell):

```powershell
$env:HUGGINGFACE_API_TOKEN = 'hf-REPLACE-WITH-YOUR-KEY'
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

- Option C: copy `backend/.env.example` to `backend/.env` and paste your key(s) into the appropriate variables (ensure `.env` remains in `.gitignore`).

4. Run the server:

```powershell
# from within backend and with the venv activated
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Security & rotating the exposed key

- You must rotate (revoke) the OpenAI API key that was previously in the repo because it was committed.
- Go to your OpenAI dashboard > API keys, revoke/delete the exposed key, then create a new key.
- Replace the value locally using Option A or B above.

Want me to automatically print a small script that revokes the old key? I can't revoke it for you, but I can prepare a checklist and commands to do it safely.
