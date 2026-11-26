@echo off
rem YoRHa Helper -- remove the Startup shortcut and the pairing key, and stop the helper.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0YoRHaHelper.ps1" -Uninstall
pause
