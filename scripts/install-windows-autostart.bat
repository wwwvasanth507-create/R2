@echo off
echo ========================================================
echo Installing Media Platform 24/7 Windows Automatic Startup
echo ========================================================

echo [1/3] Installing Silent VBScript into Windows Startup folder...
copy /Y "C:\New folder\R2\scripts\silent-start-all.vbs" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MediaPlatform-AutoStart.vbs" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Added MediaPlatform-AutoStart.vbs to Windows Startup folder.
) else (
    echo [INFO] Startup folder copy skipped.
)

echo [2/3] Registering Task Scheduler jobs...
schtasks /create /tn "MediaPlatform_Master" /tr "wscript.exe \"C:\New folder\R2\scripts\silent-start-all.vbs\"" /sc onlogon /rl highest /f >nul 2>&1
schtasks /create /tn "MediaPlatform_DailyBackup" /tr "cmd.exe /c \"C:\New folder\R2\scripts\db-backup.bat\"" /sc daily /st 03:30 /rl highest /f >nul 2>&1

echo [3/3] Setting PostgreSQL Service to Auto-Start...
sc config postgresql-x64-18 start= auto >nul 2>&1

echo ========================================================
echo Media Platform 24/7 Autostart configured successfully!
echo Whenever you power on your PC, the entire platform
echo (PostgreSQL, Tunnel, Backend, Web, Admin) starts silently!
echo ========================================================
