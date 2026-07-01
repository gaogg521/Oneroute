@echo off
echo [开发模式] Go 后端 → 3001，Rsbuild 前端 dev server 自动代理到 3001
echo 注意：此模式仅用于前端热重载开发，不要在生产环境使用

start "new-api backend (dev:3001)" cmd /k "cd /d D:\AI_Agent\new-api && set PORT=3001&& go run ."

timeout /t 2 /nobreak > nul

start "new-api frontend (bun dev)" cmd /k "cd /d D:\AI_Agent\new-api\web\default && bun run dev"
