# Bilibili Follow (B站特別關注) - Agent 開發與避坑指南

本文件為未來的 AI Agent / 開發者提供關鍵架構全貌與致命避坑事項。無廢話、高訊噪比，所有變更前請先查閱相應段落。

---

## 1. 核心架構：雙模運行機制 (Dual-Mode Architecture)

本專案為 npm workspaces Monorepo (`server`, `web`)，具備兩個平行的運行與資料持久化管道：

```
                    ┌─── [PC 模式] ──── Express (3001) ─── server/data/*.json (原子寫入)
使用者訪問 ─────────┤
 (web: Vite 3000)   └─── [APK 獨立模式] ── CapacitorHttp 原生攔截 ─── localStorage
```

### 1.1 PC 模式 (瀏覽器開發 / 桌面)
- **架構**：前端 Vite (`localhost:3000`) + 後端 Express (`localhost:3001`)。
- **代理轉發**：`web/vite.config.ts` 將 `/api` 與 `/bili-img` 反向代理至 `localhost:3001`。
- **背景輪詢**：後端 `server/src/poller.ts` 定時輪詢動態與直播狀態，向前端提供快取與 SSE 推播。

### 1.2 Android APK 獨立模式 (Standalone Mode)
- **架構**：完全**不依賴** Node.js 後端！純前端離線原生運作。
- **CORS 繞過**：透過 Capacitor 原生環境 (`isCapacitorNative()`)，由 CapacitorHttp 直接發出 Java 原生請求，免除瀏覽器 CORS 限制。
- **獨立引擎**：所有請求與運算在 `web/src/standalone/` 執行（含純前端 MD5 算籤、本地狀態維護）。
- **自動降級**：`web/src/api/client.ts` 偵測到原生環境或後端連線中斷時，會無縫切換為 Standalone 模式。
- **⚠️ Agent 警告**：**新增或修改 API 介面時，必須同步修改 `web/src/standalone/` 對應的實作，否則 Android APK 必然損壞！**

---

## 2. 資料儲存與持久化規範

| 模式 | 儲存位置 | 關鍵模組 | 併發與安全機制 |
| :--- | :--- | :--- | :--- |
| **PC 後端** | `server/data/*.json` | `server/src/store/jsonStore.ts` | **原子寫入**（寫入 `.tmp` 後 rename；Windows 下具備 EPERM/EBUSY 覆蓋保底）+ `writeQueue` 依序寫入。**禁止手動直接使用 `fs.writeFile` 覆蓋資料檔！** |
| **APK 獨立** | 瀏覽器 `localStorage` | `web/src/standalone/storage.ts` | 鍵名遵循 `bili_standalone_*`（如 `bili_standalone_ups`, `bili_read_dynamics`），必須包裝 `try...catch` 防範 quota 超限。 |

---

## 3. Bilibili 風控、防盜鏈與降級防護

### 3.1 圖片防盜鏈 (HTTP 403)
- Bilibili 圖片伺服器 (`*.hdslb.com`) 嚴格校驗 `Referer`。
- **前端鐵律**：所有渲染 B 站圖片、UP 主頭像、直播封面、動態配圖的 `<img>` 標籤，**必須顯式宣告 `referrerPolicy="no-referrer"`**！
- PC 模式具備 `/bili-img?url=` 後端圖片代理 fallback，但前端仍應維持 `no-referrer` 規範。

### 3.2 WBI 簽名計算 (雙端同步機制)
- 簽名程式碼位於：後端 `server/src/bilibili/wbi.ts`、前端 `web/src/standalone/wbi.ts`。
- **過濾規則**：排除 null/undefined 參數，將值轉為字串並**嚴格剔除** `!'()*` 五個字符。
- **字典排序**：參數 Key 必須按字母升序進行 `encodeURIComponent`。
- **mixinKey 重組**：依據 `MIXIN_KEY_ENC_TAB`（64 字符重組順序表）自 `imgKey + subKey` 取前 32 位。
- **快取與保底**：WBI Key 快取 12 小時，若請求 `/x/web-interface/nav` 失敗，必須使用內建寫死的 fallback key 繼續運算。

### 3.3 雙重平滑降級策略 (Graceful Degradation)
- **個人資料**：優先調用 WBI 簽名的 `/x/space/wbi/acc/info?mid=`；若遇風控代碼 (`-352`, `412`)，自動降級調用免登入端點 `/x/web-interface/card?mid=`。
- **影片列表**：優先調用 `/x/space/wbi/arc/search`；若遭遇風控或失敗，自動降級至動態流 `/x/polymer/web-dynamic/v1/feed/space` 萃取影片卡片。

---

## 4. 常用開發指令與驗證流程

所有指令均在專案根目錄執行：

| 目的 | 指令 | 說明 |
| :--- | :--- | :--- |
| **前後端並行開發** | `npm run dev` | 使用 concurrently 同步啟動 Server (3001) 與 Web (3000) |
| **僅啟動前端** | `npm run dev:web` | 適合調試 UI 與 Standalone 模式 |
| **僅啟動後端** | `npm run dev:server` | 適合調試 API 代理與背景輪詢 |
| **全專案編譯驗證** | `npm run build` | 執行前後端雙模 TypeScript 類型檢查與 Vite 打包 |
| **單獨驗證 B 站核心 API** | `npm run test:bilibili` | 測試 UID 解析、WBI 算籤、UP 主資料、直播狀態、動態拉取 |
| **Android APK 打包** | `.\build-apk.bat` | 包含：前端 build → `npx cap sync android` → Gradle 打包 APK |

---

## 5. Windows 腳本編寫致命陷阱 (Windows Batch Rules)

在編寫或修改 `.bat` / `.cmd` 腳本時，必須遵循以下規則：

1. **編碼與換行格式**：
   - 必須使用 **CRLF** 換行（LF 會導致 Windows CMD 解釋錯位）。
   - 檔案開頭必須宣告 `@echo off` 與 `chcp 65001 >nul`，防止終端中文亂碼。
2. **Parenthesis Trap (括號陷阱)**：
   - **問題**：在 `if (...)` 或 `for (...)` 括號區塊內，若執行 `echo (文字)`，CMD 解釋器會把文字中的 `)` 誤判為條件區塊結尾，造成語法報錯並閃退。
   - **規範**：括號文字必須跳脫 `^)`，或**優先採用 Guard Clauses 標籤結構**（Early Return），嚴禁深層巢狀括號：
   ```cmd
   :: 正確做法：Guard Clause + 標籤跳轉
   where java >nul 2>nul
   if %errorlevel% neq 0 goto :no_java
   goto :java_ok

   :no_java
   echo [提示] 尚未安裝 Java 環境
   exit /b 1

   :java_ok
   ```

---

## 6. Agent 變更自檢清單 (Pre-Commit Checklist)

在交付任何程式碼修改前，確認已落實以下檢查：
- [ ] 涉及資料修改時，是否同時驗證了 `jsonStore.ts` (後端) 與 `standalone/storage.ts` (前端)？
- [ ] 所有新增的圖片/影片封面標籤是否均標註了 `referrerPolicy="no-referrer"`？
- [ ] 修改 B 站爬取邏輯後，是否執行過 `npm run test:bilibili` 確保解析與降級正常？
- [ ] 是否執行過 `npm run build` 確保前後端 TypeScript 類型完全通過？
- [ ] 程式碼中絕不殘留 `console.log` 調試語句或未經討論的龐大依賴套件。
