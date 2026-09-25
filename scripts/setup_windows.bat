@echo off
echo Setting up DNSentinel on Windows...
cd %~dp0\..

echo 1. Creating Python Virtual Environment...
python -m venv venv

echo 2. Installing Backend Dependencies...
call venv\Scripts\activate.bat
pip install fastapi uvicorn pydantic dnslib sqlalchemy pytest requests python-multipart

echo 3. Installing Frontend Dependencies...
cd frontend
call npm install
cd ..

echo Setup Complete!
echo Run scripts\start_backend.bat and scripts\start_frontend.bat to start.
pause
