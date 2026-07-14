@echo off
setlocal

:: ------------------------------------------------------------------
:: Temporary workaround for corporate SSL inspection (Prisma download)
:: Remove this line once NODE_EXTRA_CA_CERTS is configured correctly.
:: ------------------------------------------------------------------
set NODE_TLS_REJECT_UNAUTHORIZED=0

cd /d "%~dp0"

:: ── Backend setup ──────────────────────────────────────────────────
echo [1/5] Installing backend dependencies (this may take a minute)...
cd NodejsBackend

call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Check your network connection or npm cache.
    pause
    exit /b 1
)

echo.
echo [2/5] Setting up .env (if missing)...

if not exist .env (
    copy .env.example .env >nul
    echo   Created .env from .env.example
)

echo.
echo [3/5] Generating Prisma client...

call npx prisma generate
if errorlevel 1 (
    echo.
    echo ERROR: prisma generate failed.
    pause
    exit /b 1
)

echo.
echo Pushing Prisma schema...

call npx prisma db push --accept-data-loss
if errorlevel 1 (
    echo.
    echo ERROR: prisma db push failed.
    echo Check DATABASE_URL in .env.
    pause
    exit /b 1
)

echo.
echo Seeding database...

call npx tsx src/seed.ts
if errorlevel 1 (
    echo.
    echo WARNING: Database seed failed.
)

:: ── Frontend setup ─────────────────────────────────────────────────
cd /d "%~dp0Enterprise Compliance Platform"

echo.
echo [4/5] Installing frontend dependencies...

call npm install
if errorlevel 1 (
    echo.
    echo ERROR: Frontend npm install failed.
    pause
    exit /b 1
)

:: ── Launch servers ─────────────────────────────────────────────────
cd /d "%~dp0"

echo.
echo [5/5] Starting servers...

start "Backend" cmd /k "set NODE_TLS_REJECT_UNAUTHORIZED=0 && cd /d "%~dp0NodejsBackend" && npx tsx src/index.ts"

start "Frontend" cmd /k "cd /d "%~dp0Enterprise Compliance Platform" && npx vite"

echo.
echo ==========================================================
echo   Backend : http://localhost:3001
echo   Frontend: http://localhost:5173
echo ==========================================================
echo.
echo Close the Backend and Frontend windows to stop the servers.
echo.

endlocal