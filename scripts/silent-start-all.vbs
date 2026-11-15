Set WshShell = CreateObject("WScript.Shell")

' 1. Verify PostgreSQL Service
WshShell.Run "cmd /c net start postgresql-x64-18 >nul 2>&1", 0, True

' 2. Ensure Cloudflare Tunnel is running
WshShell.Run "cmd /c tasklist /FI ""IMAGENAME eq cloudflared.exe"" | findstr /i ""cloudflared.exe"" >nul || start """" /min ""C:\KuttyChat_Server\scripts\start-tunnel.bat""", 0, False

' 3. Start Media Platform Backend (Port 4000)
WshShell.Run "cmd /c cd /d ""C:\New folder\R2"" && node apps\backend\dist\main.js", 0, False

' 4. Start Media Platform Consumer Web Portal (Port 3000)
WshShell.Run "cmd /c cd /d ""C:\New folder\R2"" && npm.cmd run start -w apps/web", 0, False

' 5. Start Media Platform Admin Console (Port 3001)
WshShell.Run "cmd /c cd /d ""C:\New folder\R2"" && npm.cmd run start -w apps/admin", 0, False
