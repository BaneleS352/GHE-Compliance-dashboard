@echo off
cd /d "%~dp0"

:: ── Backend setup ──
echo [1/5] Installing backend dependencies...
cd NodejsBackend
call npm install --silent 2>nul

echo [2/5] Setting up .env (if missing)...
if not exist .env (
  copy .env.example .env >nul
  echo   Created .env from .env.example — review JWT_SECRET in .env
)

echo [3/5] Generating Prisma client and pushing schema...
call npx prisma generate 2>nul
call npx prisma db push --accept-data-loss 2>nul
call npx tsx src/seed.ts 2>nul

:: ── Frontend setup ──
cd /d "%~dp0Enterprise Compliance Platform"
echo [4/5] Installing frontend dependencies...
call npm install --silent 2>nul

:: ── Launch both servers ──
cd /d "%~dp0"
echo [5/5] Starting servers...
start "backend" cmd /c "cd /d %~dp0NodejsBackend && npx tsx src/index.ts"
start "frontend" cmd /c "cd /d %~dp0Enterprise Compliance Platform && npx vite"
echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
echo Close this window to stop both servers.
