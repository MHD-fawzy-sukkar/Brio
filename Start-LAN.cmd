@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24.11 or newer is required. Install it, then reopen this file.
  pause
  exit /b 1
)
if not exist "node_modules\tsx" (
  echo First-time setup required: run pnpm install --frozen-lockfile while online.
  pause
  exit /b 1
)
if not exist "apps\web\out-lan\local\index.html" (
  echo Local pages are missing. Run pnpm lan:build while online, then reopen this file.
  pause
  exit /b 1
)
echo Starting Brio LAN. Keep this window open during the game.
node --import tsx apps/local/src/cli.ts --open
pause
