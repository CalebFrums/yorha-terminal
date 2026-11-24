@echo off
rem YoRHa Helper -- starts the helper hidden in the background (music buttons and keyboard typing
rem for the YoRHa Terminal wallpaper). To start it with Windows instead, run Install-YoRHaHelper.cmd.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0YoRHaHelper.ps1"
