@echo off
setlocal

cd /d "%~dp0"

:: ── Prerequisite checks ───────────────────────────────────────────
echo Checking requirements...
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed or is not on PATH.
    echo Install Node.js 20 LTS, restart Windows, then run dev.bat again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: npm was not found. Reinstall Node.js 20 LTS with npm enabled.
    pause
    exit /b 1
)

:: ── Backend setup ──────────────────────────────────────────────────
echo.
echo [1/6] Installing backend dependencies (first run only)...
cd NodejsBackend

if not exist node_modules\prisma\build\index.js (
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Backend setup could not download its required files.
        echo Check your internet connection and run dev.bat again.
        pause
        exit /b 1
    )
)

echo.
echo [2/6] Setting up backend settings (if missing)...

if not exist .env (
    copy .env.example .env >nul
    echo   Created .env from .env.example
)

findstr /R /C:"^DATABASE_URL=\"postgres" /C:"^DATABASE_URL=postgres" .env >nul
if errorlevel 1 (
    echo.
    echo ERROR: The database address in NodejsBackend\.env is not configured.
    echo Restore the default DATABASE_URL from .env.example, then try again.
    pause
    exit /b 1
)

echo.
echo [3/6] Checking PostgreSQL and preparing the database...
call npm run db:pg:up
if errorlevel 1 (
    echo.
    echo ERROR: Database setup could not finish, so the dashboard was not started.
    echo Make sure the PostgreSQL server in NodejsBackend\.env is running and
    echo that its address and login details are correct.
    echo If the message mentions EPERM or a file in use, close any other
    echo GHE dashboard or Node.js windows, then run dev.bat again.
    echo For other errors, share this window with your support person.
    pause
    exit /b 1
)

:: ── Frontend setup ─────────────────────────────────────────────────
cd /d "%~dp0Enterprise Compliance Platform"

echo.
echo [4/6] Installing frontend dependencies (first run only)...

if not exist node_modules\vite\bin\vite.js (
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: Frontend setup could not download its required files.
        echo Check your internet connection and run dev.bat again.
        pause
        exit /b 1
    )
)

:: ── Launch servers ─────────────────────────────────────────────────
cd /d "%~dp0"

echo.
echo [5/6] Starting servers...

start "Test OIDC Provider" cmd /k "cd /d "%~dp0NodejsBackend" && npx tsx src/scripts/test-provider.ts"

set "OIDC_AUTHORITY=http://127.0.0.1:55439"
set "OIDC_ISSUER=http://127.0.0.1:55439"
set "OIDC_AUDIENCE=ghe-test-api-audience"
set "OIDC_CLIENT_ID=local-dev-testing"

start "Backend" cmd /k "cd /d "%~dp0NodejsBackend" && npx tsx src/index.ts"

start "Frontend" cmd /k "cd /d "%~dp0Enterprise Compliance Platform" && npx vite"

echo.
echo ==========================================================
echo   Backend : http://localhost:3001
echo   Frontend: http://localhost:5173
echo   Test login: use the Developer testing quick-login control
echo ==========================================================
echo.
echo Close the Backend and Frontend windows to stop the servers.
echo.

endlocal
