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
echo [3/5] Setting up database (PostgreSQL required)...

:: PostgreSQL is the only supported provider. DATABASE_URL must be a
:: postgres(ql) URL (see .env.example). Only uncommented DATABASE_URL lines
:: match (^ anchors line start, so the commented example in .env.example is
:: ignored).
findstr /R "^DATABASE_URL.*postgres" .env >nul
if errorlevel 1 (
    echo.
    echo ERROR: DATABASE_URL must be a PostgreSQL URL.
    echo Copy .env.example to .env and point DATABASE_URL at PostgreSQL,
    echo e.g. via docker compose up -d db. SQLite is no longer supported.
    pause
    exit /b 1
)

echo   PostgreSQL detected - running versioned bring-up...
call npx tsx src/scripts/pg-up.ts
if errorlevel 1 (
    echo.
    echo ERROR: PostgreSQL bring-up failed. See output above.
    pause
    exit /b 1
)

:db_done

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
