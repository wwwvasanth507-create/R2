@echo off
title Media Platform Master 24/7 Launcher
echo ========================================================
echo   ALL-IN-ONE MEDIA PLATFORM - 24/7 SELF-HOSTED SERVER
echo ========================================================

echo [1/4] Checking PostgreSQL Service...
net start | findstr /i "postgresql" >nul
if %ERRORLEVEL% EQU 0 (
    echo PostgreSQL Service is running.
) else (
    echo Starting PostgreSQL Service...
    net start postgresql-x64-18 >nul 2>&1
)

echo [2/4] Starting Media Platform Backend (Port 4000)...
start "Media Platform Backend" /min cmd /c "C:\New folder\R2\scripts\start-backend.bat"

echo [3/4] Starting Media Platform Consumer Web Portal (Port 3000)...
start "Media Platform Web Portal" /min cmd /c "C:\New folder\R2\scripts\start-web.bat"

echo [4/4] Starting Media Platform Admin Console (Port 3001)...
start "Media Platform Admin Console" /min cmd /c "C:\New folder\R2\scripts\start-admin.bat"

echo ========================================================
echo   ALL-IN-ONE MEDIA PLATFORM IS ONLINE (24/7)!
echo ========================================================
echo Public Endpoints (Cloudflare Protected):
echo   - Web App:   https://app.wavemusic.dpdns.org
echo   - Admin:     https://admin.wavemusic.dpdns.org
echo   - API:       https://api.wavemusic.dpdns.org
echo Local Endpoints:
echo   - Web:       http://localhost:3000
echo   - Admin:     http://localhost:3001
echo   - API:       http://localhost:4000
echo ========================================================
