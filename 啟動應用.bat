@echo off
chcp 65001 >nul
title Bilibili 特別關注 - 啟動器
color 0b

cd /d "%~dp0"

echo ===================================================
echo           Bilibili 特別關注 - 桌面與服務啟動器
echo ===================================================
echo.

echo [1/4] 檢查本機運行環境...
where node >nul 2>nul
if errorlevel 1 goto :err_no_node

where npm >nul 2>nul
if errorlevel 1 goto :err_no_npm

for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
for /f "delims=" %%v in ('npm -v') do set "NPM_VERSION=%%v"
echo [OK] 檢測到 Node.js %NODE_VERSION% 與 npm %NPM_VERSION%
echo.

echo [2/4] 檢查專案依賴模組...
if not exist "node_modules" goto :install_deps
echo [OK] 依賴模組已就緒。
goto :start_browser

:install_deps
echo [*] 尚未安裝依賴，正在執行 npm install (請稍候)...
call npm install
if errorlevel 1 goto :err_install_failed
echo [OK] 依賴安裝完成。

:start_browser
echo.

echo [3/4] 設定 3 秒後自動開啟瀏覽器...
start "" /b cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:3000"
echo.

echo [4/4] 正在啟動服務 (npm run dev)...
echo ===================================================
echo   服務運行中...
echo   - 前端介面: http://localhost:3000
echo   - 後端 API:  http://localhost:3001/api
echo.
echo   [提示] 請保持此視窗開啟以維持服務運作。
echo   [提示] 按 Ctrl + C 可停止服務。
echo ===================================================
echo.

call npm run dev
if errorlevel 1 goto :err_service_exit

echo.
echo 服務已正常關閉。
pause
exit /b 0

:err_no_node
color 0c
echo.
echo [錯誤] 未檢測到 Node.js 環境！
echo 請前往 https://nodejs.org/ 下載並安裝 Node.js。
echo 安裝完成後請重新執行此腳本。
echo.
pause
exit /b 1

:err_no_npm
color 0c
echo.
echo [錯誤] 未檢測到 npm 套件管理工具！
echo 請確認 Node.js 安裝完整。
echo.
pause
exit /b 1

:err_install_failed
color 0c
echo.
echo [錯誤] 依賴安裝失敗！請檢查網路連線或權限。
echo.
pause
exit /b 1

:err_service_exit
color 0c
echo.
echo [警告] 服務異常退出或手動中止。
echo.
pause
exit /b 1
