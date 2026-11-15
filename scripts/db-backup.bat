@echo off
setlocal enabledelayedexpansion

set BACKUP_DIR=C:\New folder\R2\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set DT=%%I
if "%DT%"=="" set DT=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%

set BACKUP_FILE=%BACKUP_DIR%\media_platform_backup_%DT%.sql
set PGPASSWORD=2008

echo [%DATE% %TIME%] Starting PostgreSQL backup for media_platform...
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -d media_platform -w -f "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [%DATE% %TIME%] Backup successful: %BACKUP_FILE%
) else (
    echo [%DATE% %TIME%] Backup failed with exit code %ERRORLEVEL%
)

:: Prune backups older than 7 days
forfiles /p "%BACKUP_DIR%" /m *.sql /d -7 /c "cmd /c del @path" 2>nul
