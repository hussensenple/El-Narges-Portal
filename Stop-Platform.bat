@echo off
title El-Narges Platform - System Stopper
color 0C
echo ========================================================
echo   🛑 Stopping El-Narges Platform Services...
echo ========================================================
echo.

echo Terminating Node.js Backend Server and Vite Frontend...
taskkill /F /IM node.exe /T 2>nul

echo Terminating Ngrok Webhook Tunnel...
taskkill /F /IM ngrok.exe /T 2>nul

echo.
echo ========================================================
echo   ✅ All platform services stopped successfully!
echo ========================================================
timeout /t 2 /nobreak > nul
