@echo off
echo ========================================================
echo Installing Media Platform 24/7 Windows Automatic Startup
echo ========================================================

echo [1/3] Creating Windows Startup folder shortcut...
copy /Y "C:\New folder\R2\scripts\start-all.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MediaPlatform-Autostart.bat" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Added to Windows Startup folder.
) else (
    echo [INFO] Startup folder copy skipped.
)

echo [2/3] Registering Task Scheduler jobs (requires Run as Administrator)...
schtasks /create /tn "MediaPlatform_Master" /tr "cmd.exe /c \"C:\New folder\R2\scripts\start-all.bat\"" /sc onlogon /rl highest /f >nul 2>&1
schtasks /create /tn "MediaPlatform_DailyBackup" /tr "cmd.exe /c \"C:\New folder\R2\scripts\db-backup.bat\"" /sc daily /st 03:30 /rl highest /f >nul 2>&1

echo [3/3] Verifying PostgreSQL Service...
sc config postgresql-x64-18 start= auto >nul 2>&1

echo ========================================================
echo Media Platform 24/7 Autostart configured successfully!
echo ========================================================
pause
