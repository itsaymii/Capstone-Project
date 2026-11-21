@echo off
rem Creates (or replaces) the daily 3:00 AM "DRRMO Earthquake Sync" task in Windows Task Scheduler.
rem Double-click it once on the computer that runs Django and keeps backend\db.sqlite3.

setlocal
set "TASK_NAME=DRRMO Earthquake Sync"
set "SCRIPT=%~dp0sync_earthquakes.bat"

schtasks /Create /TN "%TASK_NAME%" /TR "\"%SCRIPT%\"" /SC DAILY /ST 03:00 /F
if errorlevel 1 (
    echo.
    echo Could not create the task. Right-click this file and choose "Run as administrator", then try again.
    pause
    exit /b 1
)

echo.
echo Done. "%TASK_NAME%" will run every day at 3:00 AM.
echo To run it now:    schtasks /Run /TN "%TASK_NAME%"
echo To check it:      schtasks /Query /TN "%TASK_NAME%" /V /FO LIST
echo To remove it:     schtasks /Delete /TN "%TASK_NAME%" /F
pause
