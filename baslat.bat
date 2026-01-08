@echo off
setlocal
echo ==========================================
echo    TELEGRAM TR CHANGE - STARTER
echo ==========================================
echo.

:: Go to current directory
cd /d "%~dp0"

:: Add local node_modules bin to PATH
set PATH=%PATH%;%~dp0node_modules\.bin

echo [1/2] Installing dependencies...
echo Please wait, this may take a few minutes...
echo.

:: Use npm install with verbose log
call npm install --loglevel info

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    echo Please check your internet connection or Node.js installation.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Starting application...
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Application failed to start.
    pause
)
pause
