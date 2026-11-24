@echo off
rem YoRHa Helper -- start it now and with every Windows sign-in (adds a Startup shortcut).
rem To undo: Uninstall-YoRHaHelper.cmd
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0YoRHaHelper.ps1" -Install
pause
