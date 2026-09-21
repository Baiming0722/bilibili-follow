# B站特別關注（bilibili-follow）

集中追蹤指定 Bilibili UP 主的動態、新影片與直播狀態——支援 SSE 即時推播、已讀標記、資料備份，並提供瀏覽器、桌面與離線 APK 三種運行模式。

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-blue?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white)

## ✨ 功能特性

- **UP 主管理**：以 UID 新增 / 刪除追蹤對象，查看資料與影片列表
- **動態 Feed**：動態流瀏覽、圖片預覽、單則已讀 / 全部已讀
- **直播狀態總覽**：即時掌握追蹤 UP 主的開播狀態
- **SSE 即時推播**：後端輪詢偵測到更新即時推送至前端
- **資料備份**：設定與追蹤資料一鍵匯出 / 匯入
- **防盜鏈處理**：B 站圖片統一 `no-referrer` + 後端圖片代理 fallback
- **風控降級**：WBI 簽名端點失敗時自動切換免登入端點，雙端平滑降級
- **離線使用**：Android APK 無需後端，純前端獨立運行

## 🏗️ 架構與運行模式

npm workspaces Monorepo：`server`（Express 4 + TypeScript）+ `web`（React 19 + Vite 6 + Tailwind CSS 4 + TanStack Query 5 + Capacitor 8）。

```
                   ┌── [PC 瀏覽器] Vite (3000) ── /api 代理 ── Express (3001) ── data/*.json
使用者 ────────────┼── [Electron 桌面] 後端託管 web/dist，托盤常駐
                   └── [Android APK] CapacitorHttp 原生請求（繞過 CORS）── localStorage
```

| 模式 | 後端 | 資料儲存 | 說明 |
| --- | --- | --- | --- |
| **PC 瀏覽器** | Express (3001) | `server/data/*.json` 或 `~/.bilibili-follow/data`（JSON 原子寫入） | 背景 poller 輪詢 + SSE 推播 |
| **Electron 桌面** | 內建託管 `web/dist` | 同 PC 模式 | 托盤常駐 |
| **Android APK** | 無（純前端） | `localStorage` | CapacitorHttp 原生請求繞過 CORS，前端自帶 WBI/MD5 簽名 |

> 前端 `api/client.ts` 會在偵測到原生環境或後端斷線時，無縫切換至 Standalone 獨立模式。

## 🚀 快速開始

**環境需求**：Node.js 18+

```bash
# 安裝依賴
npm install

# 同時啟動前端 (3000) 與後端 (3001)
npm run dev
```

開啟瀏覽器訪問 `http://localhost:3000`。

## 📦 打包

| 目標 | 指令 | 產出 |
| --- | --- | --- |
| Windows 桌面 exe | `npm run dist:win` | electron-builder 打包 portable exe |
| Android APK | `.\build-apk.bat` | 前端 build → `cap sync` → Gradle 打包 |

## 🛠️ 開發指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 前後端並行開發 |
| `npm run dev:server` / `npm run dev:web` | 單獨啟動後端 / 前端 |
| `npm run build` | 全專案 TypeScript 類型檢查與打包 |
| `npm start` | 啟動生產模式 |
| `npm run test:bilibili` | 驗證 B 站核心 API（UID 解析、WBI 簽名、動態/直播拉取） |
| `npm run electron:start` | 啟動 Electron 桌面模式 |

## ⚙️ 環境變數

| 變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3001` | 後端服務埠 |
| `BILI_DATA_DIR` | `~/.bilibili-follow/data` | 後端資料儲存目錄 |

## 📁 目錄結構

```
├── server/src/
│   ├── index.ts          # 後端入口
│   ├── poller.ts         # 背景輪詢（動態 / 直播）
│   ├── routes/           # API 路由
│   ├── services/         # 業務服務
│   ├── bilibili/         # B 站 API 封裝（含 WBI 簽名）
│   ├── store/jsonStore.ts# JSON 原子寫入儲存
│   └── test-bilibili.ts  # B 站 API 驗證腳本
├── web/src/
│   ├── views/            # Feed / Videos / Live / Settings
│   ├── components/       # Card3D 等 UI 元件
│   ├── api/client.ts     # 雙模 API 客戶端（含降級）
│   └── standalone/       # APK 獨立模式引擎（WBI、storage）
├── electron/main.js      # Electron 主行程
├── build-apk.bat         # Android APK 打包腳本
└── start.bat
```

## ⚠️ 注意事項

- 本專案為**個人工具**，僅供學習與研究使用。
- 未登入狀態下受 Bilibili 風控限制，部分端點可能降級或回傳不完整資料。

## License

MIT
