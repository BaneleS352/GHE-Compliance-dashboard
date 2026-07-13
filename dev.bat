@echo off
start "backend" cmd /c "cd /d %~dp0NodejsBackend && npx tsx src/index.ts"
start "frontend" cmd /c "cd /d %~dp0Enterprise Compliance Platform && npx vite"
echo Both servers starting...
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
