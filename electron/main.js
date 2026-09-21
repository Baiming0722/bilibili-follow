import { app, BrowserWindow, Menu, Tray, nativeImage } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 打包後 main.js 位於 resources/app.asar/electron/main.js，
// 後端編譯產物位於 resources/app.asar/server/dist/index.js，
// 前端靜態由後端進程統一託管（同源 /api），故此處只需指向後端端口。
const projectRoot = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT ?? 3001);

let mainWindow = null;
let backendProcess = null;
let tray = null;
let trayPollTimer = null;

// 16x16 托盤佔位圖（asar 內外皆可用；build/icon.png 可讀時優先使用其 dataURL）
const FALLBACK_TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAd0lEQVR4nGNgwAK6Y75JdMd8i+yO+VYNxSC2BDa12DTO7Y759h8HnovToO6YbxbdMd8e49EMwyA1FthsJkYzsiESyAbgczZO7yDbTqpmGJZggIYwuQZEMkCjiVwDqqliAMVeoCwQKY5GqiQkipMyVTITFoOIys4AMQk0E6PdVooAAAAASUVORK5CYII=";

function getBackendEntry() {
  return path.join(projectRoot, "server", "dist", "index.js");
}

function startBackend() {
  if (backendProcess) return;

  // 共用存檔：與網頁版（npm run dev/start）共用同一份存檔，
  // 唯一真源為 ~/.bilibili-follow/data（與後端 jsonStore.ts 預設一致，不再使用 userData）。
  const dataDir = path.join(os.homedir(), ".bilibili-follow", "data");
  console.warn(`[Electron] DATA_DIR=${dataDir}`);

  backendProcess = fork(getBackendEntry(), [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      BILI_DATA_DIR: dataDir
    },
    silent: false
  });

  backendProcess.on("error", (err) => {
    console.error("[Electron] 後端子進程啟動失敗:", err);
  });

  backendProcess.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[Electron] 後端子進程異常退出 (code=${code}, signal=${signal})`);
    }
    backendProcess = null;
  });
}

function killBackendNow() {
  if (!backendProcess) return;
  try {
    backendProcess.kill();
  } catch {
    // 進程已退出時忽略
  }
}

function waitBackendExit(timeoutMs) {
  if (!backendProcess) return Promise.resolve();
  return new Promise((resolve) => {
    const child = backendProcess;
    const timer = setTimeout(resolve, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// 優雅關閉：先調後端排空端點（等寫入佇列落盤），再發 kill，
// 等 exit 事件 + 3s 保底。Windows 下 kill 即 TerminateProcess，
// 故排空端點是防丟的主要保障，kill 只是收尾。
async function stopBackendGracefully() {
  if (!backendProcess) return;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/shutdown/flush`, {
      method: "POST",
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) throw new Error(`flush 狀態異常: ${res.status}`);
  } catch {
    // 後端未就緒或已退出時直接進入 kill 收尾，不阻塞退出
  }
  killBackendNow();
  await waitBackendExit(3000);
  backendProcess = null;
}

function stopBackend() {
  killBackendNow();
  backendProcess = null;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindowVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }
  showMainWindow();
}

function resolveTrayIcon() {
  try {
    const iconPath = path.join(projectRoot, "build", "icon.png");
    const pngBuffer = fs.readFileSync(iconPath);
    if (pngBuffer.length === 0) throw new Error("空圖標文件");
    return nativeImage.createFromDataURL(
      `data:image/png;base64,${pngBuffer.toString("base64")}`
    );
  } catch {
    return nativeImage.createFromDataURL(FALLBACK_TRAY_ICON_DATA_URL);
  }
}

async function updateTrayTooltip() {
  if (!tray) return;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    if (!res.ok) throw new Error(`health 狀態異常: ${res.status}`);
    tray.setToolTip("B站特別關注 — 運行中");
  } catch {
    // 後端未就緒時僅更新 tooltip，靜默不拋錯
    if (tray) tray.setToolTip("B站特別關注 — 後端未就緒");
  }
}

function createTray() {
  if (tray) return;
  tray = new Tray(resolveTrayIcon());

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "顯示/隱藏視窗",
      click: () => toggleMainWindowVisibility()
    },
    { type: "separator" },
    {
      label: "退出應用",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("B站特別關注");

  tray.on("click", () => toggleMainWindowVisibility());
  tray.on("double-click", () => showMainWindow());

  updateTrayTooltip();
  trayPollTimer = setInterval(updateTrayTooltip, 30_000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: "B站特別關注",
    icon: path.join(projectRoot, "build", "icon.png"),
    backgroundColor: "#05060a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 移除預設選單欄，保持簡潔原生感
  mainWindow.setMenuBarVisibility(false);

  // 防抖加載：後端子進程尚未 listen 完成時，以 100ms 間隔重試
  const loadURLWithRetry = () => {
    if (!mainWindow) return;
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`).catch(() => {
      setTimeout(loadURLWithRetry, 100);
    });
  };

  loadURLWithRetry();

  // 托盤常駐：點 X 關閉僅隱藏視窗（後端 poller/SSE 繼續運行），真正退出走托盤右鍵
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 單一實例保護：防止多重啟動造成 port 衝突與重複視窗
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startBackend();
    createWindow();
    createTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  // 托盤常駐：還有托盤圖標可恢復，關閉全部視窗也不退出（後端繼續輪詢）
  app.on("window-all-closed", () => {});

  // 優雅退出鏈路：before-quit 先攔下預設退出，待後端排空寫入並結束後再真正退出。
  // 關窗僅隱藏（後端繼續運行），此處只在托盤「退出應用」/app.quit() 時觸發一次。
  let quitAfterFlush = false;
  app.on("before-quit", (event) => {
    if (quitAfterFlush) return;
    event.preventDefault();
    app.isQuitting = true;
    if (trayPollTimer) {
      clearInterval(trayPollTimer);
      trayPollTimer = null;
    }
    (async () => {
      try {
        await stopBackendGracefully();
      } finally {
        quitAfterFlush = true;
        app.quit();
      }
    })();
  });
}
