@echo off
echo Starting DNSentinel Demo Sequence...
powershell -Command "Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/demo/start' -Method Post"
echo Demo started. Check the Dashboard for alerts.
pause
