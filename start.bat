@echo off
echo ============================================
echo  ResQNet - AI Disaster Relief System
echo ============================================

echo.
echo [1/3] Installing Python dependencies...
cd backend
pip install -r requirements.txt

echo.
echo [2/3] Setting up environment...
if not exist .env (
    copy .env.example .env
    echo Created .env from template. Please update MYSQL credentials if needed.
)

echo.
echo [3/3] Starting Flask backend server...
echo Backend will run at: http://127.0.0.1:5000
echo.
echo To open the frontend, open frontend\index.html in your browser.
echo Or use a local server: python -m http.server 5500 (in the frontend folder)
echo.
start "" cmd /k "cd backend && python app.py"

echo.
echo Starting frontend dev server...
cd ..\frontend
start "" cmd /k "python -m http.server 5500"

echo.
echo ============================================
echo  ResQNet is running!
echo  Frontend: http://localhost:5500
echo  Backend:  http://localhost:5000
echo ============================================
pause
