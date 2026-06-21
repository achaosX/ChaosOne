@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0installer\install-windows.ps1"

