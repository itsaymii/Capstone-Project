@echo off
rem Daily USGS earthquake sync for the city-wide earthquake risk score (Scoring page).
rem Run by the "DRRMO Earthquake Sync" scheduled task; you can also double-click it to sync now.
rem Works from any folder: it finds the backend folder and the project's .venv by itself.

setlocal
cd /d "%~dp0.."

set "PY=..\.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=.venv\Scripts\python.exe"
if not exist "%PY%" (
    echo Could not find the virtual environment ^(.venv^) next to the project or inside backend.
    exit /b 1
)

if not exist logs mkdir logs
echo ==== %date% %time% ==== >> logs\earthquake_sync.log
"%PY%" manage.py sync_earthquake_events --days 90 >> logs\earthquake_sync.log 2>&1
set "RESULT=%ERRORLEVEL%"
if "%RESULT%"=="0" (echo Sync finished. Details are in backend\logs\earthquake_sync.log) else (echo Sync failed. See backend\logs\earthquake_sync.log)
exit /b %RESULT%
