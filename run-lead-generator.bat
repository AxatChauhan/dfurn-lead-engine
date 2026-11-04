@echo off
setlocal enabledelayedexpansion
title D'furn Modular Systems - Lead Generator

echo ===============================================================================
echo              D'FURN MODULAR SYSTEMS - LEAD GENERATOR (DESKTOP)
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

if not exist "node_modules" (
    echo [SETUP] Installing required dependencies...
    call npm install
)

echo [LAUNCH] Starting D'furn Lead Generator...
echo.

call npx tsx scripts/lead-generator.ts %*

echo.
echo ===============================================================================
echo Lead generation session finished.
echo Leads have been pushed directly to your cloud Supabase database.
echo Sales reps can view and call them live at: https://dfurn-lead-engine.vercel.app
echo ===============================================================================
echo.
pause
