@echo off
chcp 65001 > nul
title BPMN Studio Server

echo.
echo  ██████╗ ██████╗ ███╗   ███╗███╗   ██╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗ 
echo  ██╔══██╗██╔══██╗████╗ ████║████╗  ██║    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
echo  ██████╔╝██████╔╝██╔████╔██║██╔██╗ ██║    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
echo  ██╔══██╗██╔═══╝ ██║╚██╔╝██║██║╚██╗██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
echo  ██████╔╝██║     ██║ ╚═╝ ██║██║ ╚████║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
echo  ╚═════╝ ╚═╝     ╚═╝     ╚═╝╚═╝  ╚═══╝    ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ 
echo.
echo  BPMN 2.0 Generator powered by bpmn-auto-layout + Camunda Compatible
echo  ════════════════════════════════════════════════════════════════════
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js chua duoc cai dat!
    echo  Vao https://nodejs.org de tai Node.js ^>= 18
    pause
    exit /b 1
)

:: Show Node version
for /f "tokens=*" %%v in ('node --version') do echo  Node.js: %%v

:: Move to server directory
cd /d "%~dp0server"

:: Install dependencies if needed
if not exist "node_modules" (
    echo.
    echo  [INFO] Dang cai dat dependencies (lan dau ~1-2 phut)...
    echo  ════════════════════════════════════════════════════════
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  [ERROR] npm install that bai!
        pause
        exit /b 1
    )
    echo  [OK] Da cai dat xong!
)

echo.
echo  [INFO] Khoi dong BPMN Studio Server...
echo  ════════════════════════════════════════════════════════════════════
echo.

:: Open browser after 2 seconds  
start "" cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:3721"

:: Start server
node server.js

pause
