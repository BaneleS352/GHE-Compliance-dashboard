@echo off
cd /d "%~dp0"

:: ── Backend setup ──
echo [1/5] Installing backend dependencies (this may take a minute)...
cd NodejsBackend
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed. Check network / npm cache.
  pause
  exit /b 1
)

echo [2/5] Setting up .env (if missing)...
if not exist .env (
  copy .env.example .env
  echo   Created .env from .env.example
)

echo [3/5] Generating Prisma client and pushing schema...
call npx prisma generate
if errorlevel 1 (
  echo ERROR: prisma generate failed.
  pause
  exit /b 1
)
call npx prisma db push --accept-data-loss
if errorlevel 1 (
  echo ERROR: prisma db push failed. Check DATABASE_URL in .env.
  pause
  exit /b 1
)
call npx tsx src/seed.ts

:: ── Frontend setup ──
cd /d "%~dp0Enterprise Compliance Platform"
echo [4/5] Installing frontend dependencies...
call npm install
if errorlevel 1 (
  echo ERROR: frontend npm install failed.
  pause
  exit /b 1
)

:: ── Launch both servers ──
cd /d "%~dp0"
echo [5/5] Starting servers...

start "backend" cmd /c "cd /d %~dp0NodejsBackend && npx tsx src/index.ts || (echo Backend exited with error code !errorlevel! & pause)"
start "frontend" cmd /c "cd /d %~dp0Enterprise Compliance Platform && npx vite || (echo Frontend exited with error code !errorlevel! & pause)"

echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo.
echo Close this window to stop both servers.
echo (Close the individual server windows to stop each one.)
