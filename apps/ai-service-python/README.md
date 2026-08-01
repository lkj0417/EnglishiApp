# EasiTalk Python AI Service

FastAPI Agent service for EasiTalk V1.0 migration.

## Local run

```powershell
cd apps/ai-service-python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 3002 --reload
```

## Endpoints

- `GET /health`
- `POST /v1/chat/tutor`
- `POST /v1/context/clear`

