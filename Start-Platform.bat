@echo off
title El-Narges Platform - System Launcher
color 0A
echo ========================================================
echo   👷 Starting El-Narges Smart Municipal Platform 🚀
echo ========================================================
echo.
echo [1/3] Launching Node.js Backend Server (Port 5000)...
start "El-Narges Backend Server (Port 5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo [2/3] Launching Ngrok Tunnel (Survey123 Live Webhook Bridge)...
start "El-Narges Ngrok Tunnel (Survey123 Bridge)" cmd /k "cd /d "%~dp0backend" && ngrok http 5000"

echo [3/3] Launching Vite Frontend UI (Port 5173)...
start "El-Narges Frontend UI (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================================
echo   ✅ All 3 services launched successfully!
echo   ⏳ Opening platform in default browser in 3 seconds...
echo ========================================================
timeout /t 3 /nobreak > nul
start http://localhost:5173

echo.
echo 💡 Note: Keep the 3 black terminal windows open (you can minimize them).
echo 🛑 To stop the platform, simply close those terminal windows.
echo.
pause
