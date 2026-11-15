@echo off
title Media Platform Admin Console (Port 3001)
cd /d "C:\New folder\R2"

:LOOP
echo [%DATE% %TIME%] Starting Next.js Admin App on port 3001...
node_modules\.bin\next.cmd start apps\admin -p 3001
echo [%DATE% %TIME%] Admin process exited with code %ERRORLEVEL%. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
