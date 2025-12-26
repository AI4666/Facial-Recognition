@echo off
cd /d "%~dp0"
echo activating virtual environment...
call venv\Scripts\activate
echo Starting Vision Server...
echo Access Docs at: http://localhost:8000/docs
python vision_server.py
pause
