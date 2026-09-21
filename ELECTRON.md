# Electron 封裝（Portable 單一 .exe）

> 對標 `bilibili-live-watch/dist-electron`。內嵌後端模式：Electron 啟動時以子進程拉起已編譯的 Express 後端，前端走同源 `/api`（SSE / 輪詢 / 持久化完整保留）。

## 開發

```bash
npm run build            # 前後端編譯（server tsc + web tsc/vite，必須 0 錯誤）
npm run electron:start   # 啟動 Electron（自動 fork server/dist，載入 http://127.0.0.1:3001）
```

- 後端端口：`3001`（可用 `PORT` 環境變數覆蓋）。
- 資料目錄（網頁版 / exe 版共用，唯一真源）：`~/.bilibili-follow/data/`（Windows 例：`C:\Users\<你>\.bilibili-follow\data\ups.json`）。`npm run dev`/`start` 與 Electron 子進程（`BILI_DATA_DIR` 顯式傳入同一路徑）寫入同一份存檔，兩邊互可見。
- 舊檔自動遷移：首次啟動時，若共用目錄尚無 `ups.json`/`settings.json`/`state.json`，後端會依序從以下 legacy 位置自動複製（僅複製、不移動、不刪除源檔；共用目錄已有檔絕不覆蓋）：
  1. `server/data/`（舊網頁版位置）
  2. `%APPDATA%/B站特別關注/data/`（舊 exe 版 `userData` 位置）
  3. `~/.config/B站特別關注/data/`（非 Windows 兜底）
  若三處都無檔則走原有初始化空檔邏輯。`BILI_DATA_DIR` 環境變數僅保留作測試覆寫。

## 打包

```bash
npm run dist:win          # build + electron-builder --win portable（僅 Portable target）
```

- 產物位置：`dist-electron/*Portable*.exe`（單一免安裝 .exe，雙擊即用）。
- 圖標：`build/icon.png`（512x512 佔位圖：深色底 + 粉藍漸層 B 字，builder 自動轉 ico；後續可替換為 256x256 以上正式圖）。
- 單例行為：`requestSingleInstanceLock`，重複雙擊只聚焦既有視窗（restore + show + focus）；關窗不退出，詳見托盤常駐。

## 工具列常駐（系統托盤 Tray）

- 關窗 ≠ 退出：點右上角 X 僅隱藏視窗（`close` 事件 `preventDefault + hide()`），後端子進程（poller/SSE）繼續運行；工作列最小化（`minimize`）保持原生行為不攔截。
- 托盤操作：左鍵單擊切換顯示/隱藏，雙擊顯示並聚焦；右鍵選單 = `顯示/隱藏視窗`、`separator`、`退出應用`。
- 真正退出：僅托盤右鍵「退出應用」（`app.isQuitting=true` + `stopBackend()` + `app.quit()`）或調起第二實例失敗時；`window-all-closed` 不再 quit，`before-quit` 負責清 tooltip 輪詢 timer 並 kill 後端。
- 圖標：優先讀 `build/icon.png` 轉 dataURL（`nativeImage.createFromDataURL`，避開 asar 路徑坑），讀不到則回退 16x16 Base64 內嵌佔位。
- 狀態提示：每 30s 輪詢 `GET /api/health`，成功 tooltip 顯示 `B站特別關注 — 運行中`，失敗顯示 `B站特別關注 — 後端未就緒`（失敗靜默，退出時 `clearInterval`）。

## 注意

- `file://` / Electron 下自動跳過 PWA Service Worker 註冊；SSE 連線失敗時靜默關閉，不阻塞主流程。
- 前端 standalone 降級邏輯未動：Electron 下 `window.Capacitor` 不存在，自動走 PC 同源模式。
