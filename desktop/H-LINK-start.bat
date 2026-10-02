@echo off
chcp 65001 >nul
REM Windows: ダブルクリックで起動。他の端末からも開く場合は: H-LINK-start.bat --lan
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ から LTS を入れてから、もう一度開いてください。
  pause
  exit /b 1
)
node desktop\launch.mjs %*
pause
