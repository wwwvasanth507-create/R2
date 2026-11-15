@echo off
title Media Platform Web Portal (Port 3000)
cd /d "C:\New folder\R2"

:LOOP
echo [%DATE% %TIME%] Starting Next.js Web App on port 3000...
node "node_modules\next\dist\bin\next" start "apps\web" -p 3000
echo [%DATE% %TIME%] Web process exited with code %ERRORLEVEL%. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
