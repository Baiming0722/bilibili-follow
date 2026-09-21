@echo off
chcp 65001 >nul
title B站特別關注 - Android APK 編譯建置腳本
color 0b

echo ===================================================
echo           B站特別關注 - Android APK 本機建置腳本
echo ===================================================
echo.

:: 1. 檢查 Java (JDK)
echo [1/5] 檢查本機 Java 環境...
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] 系統 PATH 中未檢測到 java 命令。
    echo 正在嘗試搜尋常見的 Android Studio / JDK 安裝路徑...
    
    if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
        set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        echo [OK] 找到 Android Studio 內建 JDK: %JAVA_HOME%
    ) else if exist "C:\Program Files\Java\jdk-17\bin\java.exe" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-17"
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        echo [OK] 找到 JDK 17: %JAVA_HOME%
    ) else if exist "C:\Program Files\Eclipse Adoptium\jdk-17.0*\bin\java.exe" (
        for /d %%d in ("C:\Program Files\Eclipse Adoptium\jdk-17.0*") do (
            set "JAVA_HOME=%%d"
            set "PATH=%%d\bin;%PATH%"
        )
        echo [OK] 找到 Adoptium JDK: %JAVA_HOME%
    ) else (
        color 0e
        echo ------------------------------------------------------------------
        echo [注意] 本機尚未安裝 JDK 17+ 或未設定環境變數。
        echo.
        echo 【替代方案推薦】
        echo 1. 本專案已提供 GitHub Actions 自動編譯工作流：
        echo    只需將程式碼推送到 GitHub，即可在「Actions」分頁自動下載編譯好的 APK！
        echo 2. 或者安裝 Android Studio 並開啟目錄：
        echo    web\android
        echo    點擊「Build」-^>「Build Bundle(s) / APK(s)」-^>「Build APK(s)」。
        echo 3. 下載並安裝 JDK 17 (如 Eclipse Temurin 或 Oracle JDK)。
        echo ------------------------------------------------------------------
        echo.
        pause
        exit /b 1
    )
)

:: 2. 編譯前端網頁資源
echo [2/5] 編譯前端產物 (npm run build)...
cd /d "%~dp0web"
call npm run build
if %errorlevel% neq 0 (
    color 0c
    echo [錯誤] 前端打包失敗！
    pause
    exit /b 1
)

:: 3. 同步至 Android 原生專案
echo [3/5] 同步靜態資源與外掛至 Android (npx cap sync android)...
call npx cap sync android
if %errorlevel% neq 0 (
    color 0c
    echo [錯誤] Capacitor 同步失敗！
    pause
    exit /b 1
)

:: 4. 執行 Gradle 編譯 APK
echo [4/5] 執行 Gradle Assemble Debug...
cd /d "%~dp0web\android"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    color 0c
    echo [錯誤] Gradle APK 編譯失敗，請檢查 Android SDK 配置。
    pause
    exit /b 1
)

:: 5. 複製 APK 至專案根目錄
echo [5/5] 整理輸出產物...
cd /d "%~dp0"
if exist "web\android\app\build\outputs\apk\debug\app-debug.apk" (
    copy /y "web\android\app\build\outputs\apk\debug\app-debug.apk" "B站特別關注-v1.0.0.apk" >nul
    color 0a
    echo.
    echo ===================================================
    echo   [成功] APK 編譯完成！
    echo   產物位置: %~dp0B站特別關注-v1.0.0.apk
    echo ===================================================
) else (
    echo [警告] 未在預期路徑找到產出的 APK 檔案。
)

echo.
pause
