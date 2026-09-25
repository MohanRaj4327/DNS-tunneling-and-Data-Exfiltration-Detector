@echo off
echo Starting DNSentinel Backend and DNS Monitor...
cd %~dp0\..
call venv\Scripts\activate.bat
start "DNSentinel FastAPI" python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
start "DNSentinel Monitor" python backend\dns_monitor\server.py
echo Backend services started.
