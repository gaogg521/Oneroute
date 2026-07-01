@echo off
cd /d D:\AI_Agent\new-api\web\default
echo [1/3] Building frontend...
call "C:\Users\allenzhao\AppData\Roaming\npm\bun.cmd" run build
if %errorlevel% neq 0 ( echo Frontend build failed! & pause & exit /b 1 )

cd /d D:\AI_Agent\new-api
echo [2/3] Compiling backend...
go build -o new-api.exe .
if %errorlevel% neq 0 ( echo Backend build failed! & pause & exit /b 1 )

echo [3/3] Restarting...
taskkill /f /im new-api.exe 2>nul
timeout /t 1 /nobreak >nul
start "new-api" new-api.exe

echo Done! http://localhost:3000
pause
