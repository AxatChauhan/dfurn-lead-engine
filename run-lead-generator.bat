@echo off
setlocal enabledelayedexpansion
title D'furn Modular Systems - Lead Generator GUI

echo ===============================================================================
echo              D'FURN MODULAR SYSTEMS - LEAD GENERATOR (DESKTOP GUI)
echo      Dedicated Local Operator Tool with Stealth Residential Scraping
echo ===============================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js v20 or higher to run the Lead Generator.
    echo.
    pause
    exit /b 1
)

if "%1"=="--cli" (
    echo [LAUNCH] Starting Terminal CLI Mode...
    shift
    call npx tsx scripts/lead-generator.ts %*
    pause
    exit /b 0
)

echo [1/3] Checking local engine status on port 3001...
netstat -ano | findstr 3001 >nul 2>nul
if %errorlevel% neq 0 (
    echo [2/3] Booting local desktop engine background server...
    start "D'furn Desktop Engine Server" /min cmd /c "npx next dev -p 3001"
    echo [WAIT] Waiting 5 seconds for server initialization...
    timeout /t 5 /nobreak >nul
) else (
    echo [2/3] Local engine server is already active on port 3001.
)

echo [3/3] Launching D'furn Lead Generator Desktop GUI Window...

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="http://localhost:3001/generator" --window-size=1400,920
    exit /b 0
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="http://localhost:3001/generator" --window-size=1400,920
    exit /b 0
)

start "" "http://localhost:3001/generator"
exit /b 0
