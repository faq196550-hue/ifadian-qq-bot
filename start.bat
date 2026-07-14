@echo off
title Afdian Tools

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found, please install Node.js 18+
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    call npm install
)

if not exist "config.json" (
    echo [HINT] config.json not found.
    echo        Copy config.example.json to config.json
    pause
)

if /i "%1"=="check" goto :check_order
if /i "%1"=="bot"   goto :run_bot
if /i "%1"=="help"  goto :help
if /i "%1"=="/?"    goto :help
if /i "%1"=="-h"    goto :help
if /i "%1"=="--help" goto :help
if not "%1"=="" (
    echo [ERROR] Unknown argument: %1
    echo Usage: start.bat help
    pause
    exit /b 1
)

:menu
cls
echo ====================================
echo        Afdian Tools
echo ====================================
echo.
echo   1 - Check Order
echo   2 - Start QQ Bot
echo   3 - Help
echo   0 - Exit
echo.
set /p _opt=" Choice (0/1/2/3): "
if "%_opt%"=="1" goto :check_order_menu
if "%_opt%"=="2" goto :run_bot_menu
if "%_opt%"=="3" goto :help
if "%_opt%"=="0" exit /b 0
echo  Invalid input
pause
goto :menu

:check_order_menu
cls
echo == Check Order ==
echo.
set /p ORDER_NO=" Order number: "
if "%ORDER_NO%"=="" goto :check_order_menu
echo.
echo ------------------------------------
node src/cli.js %ORDER_NO% -c config.json
echo ------------------------------------
echo.
pause
goto :menu

:check_order
shift
set ORDER_NO=%1
if "%ORDER_NO%"=="" (
    echo Usage: start.bat check ^<ORDER_NO^>
    exit /b 1
)
node src/cli.js %ORDER_NO% -c config.json
exit /b 0

:run_bot_menu
cls
echo == Start QQ Bot ==
echo.
echo  Note: Bot runs continuously.
echo  Press Ctrl+C to stop.
echo.
set /p GROUP_ID=" Group number: "
if "%GROUP_ID%"=="" goto :run_bot_menu
echo.
echo ------------------------------------
echo Starting bot, press Ctrl+C to stop...
echo ------------------------------------
node src/bot.js %GROUP_ID%
echo.
pause
goto :menu

:run_bot
shift
set GROUP_ID=%1
if "%GROUP_ID%"=="" (
    echo Usage: start.bat bot ^<GROUP_ID^>
    exit /b 1
)
node src/bot.js %GROUP_ID%
exit /b 0

:help
cls
echo ====================================
echo        Afdian Tools - Help
echo ====================================
echo.
echo  Usage:
echo    start.bat               Menu
echo    start.bat check ^<order^>  Check order
echo    start.bat bot ^<group^>    Start QQ bot
echo    start.bat help           Help
echo.
echo  1. Copy config.example.json -^> config.json
echo  2. Fill in ifdian user_id and token
echo     (https://afdian.net/dashboard/dev)
echo  3. Bot requires NapCat with WebSocket
echo     (See README.md)
echo.
pause
goto :menu
