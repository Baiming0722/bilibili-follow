# B站特別關注（bilibili-follow）

集中追蹤指定 Bilibili UP 主的動態、新影片與直播狀態。支援 SSE 即時推播、已讀標記、資料備份，並提供 PC 瀏覽器、Electron 桌面版與 Android 離線獨立運行 APK 三種模式。

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## ✨ 功能特性 (Features)

- **UP 主集中管理**：透過 UID 快速新增與刪除追蹤對象，一目了然掌握個人檔案、頭像與最新影片清單。
- **動態 Feed 流與已讀標記**：彙整追蹤 UP 主的圖文動態流，支援多圖預覽、單則點擊標記已讀與一鍵「全部已讀」，快速過濾未讀內容。
- **直播狀態即時掌握**：同步獲取追蹤對象的開播狀態、直播標題與分區資訊，開播時給予醒目標記。
- **SSE 即時事件推播**：後端背景 Poller 自動定時輪詢 B 站更新，並透過 Server-Sent Events 即時將最新動態推播至前端。
- **雙模運作架構**：提供標準 PC 客戶端（Vite + Express 後端）與 Android APK 獨立模式（純前端 + CapacitorHttp 離線運行）。
- **嚴格圖片防盜鏈對策**：全面強制宣告 `referrerPolicy="no-referrer"`，PC 模式搭配後端圖片代理（`/bili-img`）作為備援 fallback。
- **WBI 算籤與雙重平滑降級**：內建 WBI 簽名計算模組；遇風控代碼（`-352`, `412`）自動切換免登入端點，影片 API 受阻時平滑降級至動態流解析。
- **完整資料備份與還原**：追蹤名單、自訂設定與已讀紀錄支援一鍵完整匯出為 JSON，亦可於任何裝置直接匯入還原。

---

## 🏗️ 系統架構與技術棧 (Architecture & Tech Stack)

### 雙模運行架構流程圖

本專案採 npm workspaces Monorepo 架構（`server` 與 `web`），支援兩種平行的資料獲取與持久化管道：

```text
                    ┌─── [PC 瀏覽器] ── Vite (3000) ── /api 代理 ── Express (3001) ── data/*.json（原子寫入）
使用者存取 ─────────┼─── [Electron 桌面] 後端 Express 託管 web/dist，系統托盤常駐
 (web 前端)         └─── [Android APK]  CapacitorHttp 原生攔截（繞過 CORS）────── localStorage（離線獨立模式）
```

### 運行模式詳細對比

| 運行模式 | 後端架構 | 資料持久化儲存 | 特性說明 |
| --- | --- | --- | --- |
| **PC 瀏覽器** | Express (3001) | `server/data/*.json` 或指定目錄 | 背景 Poller 定時輪詢 + SSE 即時推播 |
| **Electron 桌面** | 內建託管 `web/dist` | 同 PC 模式 | 具備系統托盤 (Tray) 常駐與桌面通知 |
| **Android APK** | **無後端（純前端獨立運行）** | 瀏覽器 `localStorage` | 透過 CapacitorHttp 原生發送 Java 請求繞過 CORS，前端內建 WBI/MD5 簽名 |

> **前端智慧降級**：前端 `web/src/api/client.ts` 會自動偵測當前環境。在原生行動端或後端服務離線時，自動無縫切換至 Standalone 獨立模式。

### 技術棧一覽

| 領域 | 技術與版本 | 說明與職責 |
| --- | --- | --- |
| **前端框架** | React 19.0 + TypeScript 5.7 | 單頁應用、宣告式元件與強型別開發 |
| **建構工具** | Vite 6.0 | 極速 HMR 開發伺服器與前端打包編譯 |
| **狀態管理與樣式** | TanStack Query 5 + Tailwind CSS 4 | 伺服器狀態快取、資料重試機制與現代化原子樣式 |
| **後端服務** | Node.js + Express 4.21 + TypeScript | API 路由轉發、背景輪詢器（Poller）、SSE 廣播池 |
| **桌面環境** | Electron 44.0 + electron-builder 26.15 | 跨平台桌面應用殼層、系統托盤支援 |
| **行動環境** | Capacitor 8.0 (Android) | 提供原生 HTTP 容器能力，免除行動端 CORS 限制 |
| **介面語系** | 繁體中文（zh-Hant） | 完整在地化文字呈現 |

---

## 🚀 快速開始 (Quick Start)

### 環境需求

- **Node.js**：`>= 18.0.0`
- **npm**：`>= 9.0.0`

### Windows 一鍵啟動

專案根目錄已提供一鍵啟動腳本：

```bat
start.bat
```

腳本會自動檢測環境、安裝依賴，並同時啟動後端（`:3001`）與前端開發伺服器（`:3000`）。

### 手動命令列啟動

```bash
# 1. 安裝 Monorepo 完整依賴
npm install

# 2. 同步啟動前後端開發環境（前端: 3000，後端: 3001）
npm run dev
```

啟動後開啟瀏覽器訪問 `http://localhost:3000` 即可使用。

### 生產伺服器部署

```bash
# 編譯前後端專案
npm run build

# 啟動後端生產伺服器
npm start
```

---

## 📦 打包與分發 (Build & Packaging)

### 1. Electron Windows 桌面版

```bash
# 啟動本地 Electron 偵錯
npm run electron:start

# 打包 Windows 免安裝單一執行檔（產物將輸出至 dist-electron/）
npm run dist:win
```

產物為 `B站特別關注 Portable 1.0.0.exe`，隨開即用並支援系統托盤常駐。

### 2. Android 原生 APK

```bat
# 執行 Android 自動化打包腳本
build-apk.bat
```

該腳本依序執行前端編譯、`npx cap sync android` 同步原生資源，並透過 Gradle 編譯出 Release 或 Debug APK。

---

## 🛠️ 開發常用指令 (Scripts)

所有指令皆於 Monorepo 專案根目錄執行：

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 使用 concurrently 同步啟動後端 (`:3001`) 與前端 (`:3000`) 開發模式 |
| `npm run dev:server` | 僅啟動 Express 後端開發伺服器 |
| `npm run dev:web` | 僅啟動 Vite 前端開發伺服器（適合 UI 或 Standalone 獨立模式除錯） |
| `npm run build` | 同步執行全專案 TypeScript 類型檢查與前後端編譯 |
| `npm run build:server` | 僅編譯後端 TypeScript 至 `server/dist` |
| `npm run build:web` | 僅打包前端 Vite 靜態資產至 `web/dist` |
| `npm start` | 啟動編譯後的 Express 生產伺服器 |
| `npm run test:bilibili` | 驗證 B 站核心 API 通訊（測試 UID 解析、WBI 算籤、動態與直播拉取） |
| `npm run electron:start` | 啟動 Electron 桌面客戶端進行本地預覽 |
| `npm run dist:win` | 打包 Windows 免安裝桌面應用（Portable .exe） |

---

## 📁 專案結構 (Directory Structure)

```text
bilibili-follow/
├── server/                         # 後端專案 (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts                # 後端入口、中介軟體配置、靜態託管與錯誤處理
│   │   ├── poller.ts               # 背景定時輪詢器（動態更新、直播狀態偵測與推播觸發）
│   │   ├── routes/                 # Express API 路由定義
│   │   ├── services/               # 核心業務邏輯（UP 主管理、動態獲取與快取維護）
│   │   ├── bilibili/               # B 站 API 介面封裝
│   │   │   ├── client.ts           # 請求封裝（含 Cookie 與 Header 模擬）
│   │   │   ├── wbi.ts              # WBI 簽名計算演算法與 Key 緩存機制
│   │   │   └── types.ts            # B 站原始回應資料型別定義
│   │   ├── store/
│   │   │   └── jsonStore.ts        # 資料庫核心：原子寫入、序列佇列與 Windows 容錯
│   │   └── test-bilibili.ts        # B 站介面驗證腳本
│   └── package.json
├── web/                            # 前端專案 (React 19 + Vite 6 + Tailwind 4)
│   ├── src/
│   │   ├── App.tsx                 # 前端主入口與版面配置
│   │   ├── main.tsx                # React DOM 掛載點
│   │   ├── api/
│   │   │   └── client.ts           # 雙模 API 客戶端（支援後端模式與原生/離線降級）
│   │   ├── standalone/             # Android APK 離線獨立模式核心模組
│   │   │   ├── engine.ts           # 純前端 B 站請求發送引擎（CapacitorHttp 封裝）
│   │   │   ├── storage.ts          # 本地 localStorage 資料持久化封裝
│   │   │   └── wbi.ts              # 前端獨立 WBI MD5 算籤演算法
│   │   ├── views/                  # 主要視圖（動態 Feed、新影片、直播間與設定頁面）
│   │   └── components/             # 通用元件庫（Card3D 視覺卡片、狀態標籤等）
│   └── package.json
├── electron/
│   └── main.js                     # Electron 主行程（視窗建立、託管後端與托盤管理）
├── android/                        # Capacitor Android 原生專案目錄
├── build-apk.bat                   # Android APK 自動化建置腳本
├── start.bat                       # Windows 一鍵開發啟動腳本
├── package.json                    # Monorepo 根目錄配置（workspaces 與全域指令）
└── LICENSE                         # MIT 授權條款檔案
```

---

## ⚙️ 環境設定與資料儲存 (Configuration & Data)

### 環境變數設定

後端服務支援透過 `.env` 或系統環境變數調整運行參數：

| 環境變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3001` | 後端 Express 服務監聽埠號 |
| `BILI_DATA_DIR` | `~/.bilibili-follow/data` | 後端資料儲存根目錄（未設定時回退至 `server/data`） |

### 資料儲存機制與安全性保證

- **PC / Electron 後端儲存**：
  - 核心模組：`server/src/store/jsonStore.ts`。
  - **原子化寫入**：寫入時先將資料存入隨機暫存檔（`.tmp`），再藉由原子更名（`fs.rename`）覆蓋目標檔案。
  - **並行防護與重試**：採用 `writeQueue` 依序串行處理寫入請求；針對 Windows 系統的 `EPERM` 與 `EBUSY` 短暫鎖定狀態提供自動延遲重試，杜絕檔案損毀風險。
- **Android APK 獨立儲存**：
  - 核心模組：`web/src/standalone/storage.ts`。
  - 資料持久化於 WebView 的 `localStorage`，鍵名遵循 `bili_standalone_*` 規範，並實作完整的例外捕獲與容量防護。

---

## ⚠️ 注意事項與限制 (Notes & Limitations)

- **個人學習用途聲明**：本專案為個人開源工具，僅供學習研究與個人資訊彙整使用，請遵守 Bilibili 社群規範與使用條款。
- **風控與介面降級**：
  - 在未攜帶會員 Cookie 情況下，高頻存取可能觸發 B 站風控代碼（`-352`, `412`）。
  - 系統內建雙重平滑降級機制：個人資訊 API 受阻時自動降級至免登入端點，影片搜尋受阻時自動切換至個人動態流抽取。
- **圖片防盜鏈防護**：Bilibili 圖片伺服器（`*.hdslb.com`）會檢查 Request Header 之 `Referer`。前端元件必須遵循 `referrerPolicy="no-referrer"` 規範，或透過 `/bili-img?url=` 代理端點讀取圖片。

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 授權條款開放原始碼。詳細條款文字請參閱專案目錄下的 [LICENSE](LICENSE) 檔案。
