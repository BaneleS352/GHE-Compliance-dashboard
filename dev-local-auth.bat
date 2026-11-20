@echo off
setlocal
cd /d "%~dp0"

:: Docker-free local employee-ID flow. Copy the two *.env.local-auth.example
:: files into the normal env files first, then run this launcher.
set "LOCAL_AUTH_ENABLED=true"
set "SEED_ON_BOOT=true"
set "GHE_TEST_IDENTITY_SEED=false"
set "EMAIL_DELIVERY_ENABLED=true"
set "SMTP_HOST=127.0.0.1"
set "SMTP_PORT=2525"
set "SMTP_SECURE=false"
set "SMTP_FROM=ghe-local@example.test"
set "VITE_ENABLE_LOCAL_AUTH=true"

start "Local email emulator" cmd /k "cd /d "%~dp0NodejsBackend" && npm run email:emulator"
start "Backend" cmd /k "cd /d "%~dp0NodejsBackend" && set LOCAL_AUTH_ENABLED=true&&set SEED_ON_BOOT=true&&set GHE_TEST_IDENTITY_SEED=false&&set EMAIL_DELIVERY_ENABLED=true&&set SMTP_HOST=127.0.0.1&&set SMTP_PORT=2525&&set SMTP_FROM=ghe-local@example.test&&npx tsx src/index.ts"
start "Frontend" cmd /k "cd /d "%~dp0Enterprise Compliance Platform" && set VITE_ENABLE_LOCAL_AUTH=true&&npx vite"

echo Docker-free local employee authentication started.
echo SMS inbox: http://localhost:3001/api/auth/local/inbox
echo Email inbox: http://localhost:8025
endlocal
