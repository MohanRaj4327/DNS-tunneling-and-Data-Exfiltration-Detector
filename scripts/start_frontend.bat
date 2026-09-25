@echo off
echo Starting DNSentinel Frontend...
cd %~dp0\..\frontend
call npm.cmd run dev
