@echo off
title Media Platform Backend (Port 4000)
cd /d "C:\New folder\R2"

:LOOP
echo [%DATE% %TIME%] Starting Media Platform Backend on port 4000...
node apps/backend/dist/main.js
echo [%DATE% %TIME%] Backend process exited with code %ERRORLEVEL%. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
