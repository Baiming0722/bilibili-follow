import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UpUser, AppSettings, PollerState } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 共用存檔設計：網頁版（npm run dev/start）與 exe 版（Electron 子進程）共用同一份存檔，
// 唯一真源為使用者家目錄下的 `.bilibili-follow/data`（仿 bilibili-live-watch 外置模式），
// 避開安裝目錄 / asar 唯讀區與各平台權限坑。BILI_DATA_DIR 僅保留作測試覆寫。
const SHARED_DATA_DIR = path.join(os.homedir(), '.bilibili-follow', 'data');
const DATA_DIR = process.env.BILI_DATA_DIR ?? SHARED_DATA_DIR;

const UPS_FILE = path.join(DATA_DIR, 'ups.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

// 啟動定位日誌（warn 級）：exe / dev 路徑漂移時第一時間可見，不堆 console.log
console.warn(`[JsonStore] DATA_DIR=${DATA_DIR}`);

/** 供 /api/shutdown/flush 與啟動日誌查詢最終存檔目錄（唯讀，不暴露寫入口） */
export function getDataDir(): string {
  return DATA_DIR;
}

const DEFAULT_SETTINGS: AppSettings = {
  pollIntervalLiveSec: 60,
  pollIntervalDynamicSec: 300,
  enableNotifications: true,
  notifyLive: true,
  notifyVideo: true,
  notifyDynamic: true,
  soundEnabled: true,
  theme: 'dark'
};

const DEFAULT_STATE: PollerState = {
  lastLiveCheckTime: 0,
  lastDynamicCheckTime: 0,
  knownLiveUids: [],
  knownDynamicIds: {},
  knownVideoBvids: {}
};

/**
 * 確保儲存目錄存在（首次呼叫時先等舊檔自動遷移完成，避免空檔搶位）
 */
async function ensureDir(): Promise<void> {
  await migrateLegacyDataFiles();
  if (!fsSync.existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * 空檔判定：不存在 / 0 bytes / 空白 / `[]` / `{}` / `null` 均視為「無有效資料」。
 * 用途：遷移時目標空檔不算數（仍觸發遷移救回 legacy 好檔）；
 * 且遷移源若自身為空檔則跳過、不把空內容複製過來。
 */
function readIfUsable(filePath: string): string | null {
  if (!fsSync.existsSync(filePath)) return null;
  let raw: string;
  try {
    raw = fsSync.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed === '[]' || trimmed === '{}' || trimmed === 'null') return null;
  return raw;
}

/**
 * 舊檔自動遷移（防丟失核心）：
 * 若共用目錄尚無某個存檔檔，依序檢查 legacy 位置並自動複製（僅複製、不移動、不刪除源檔）。
 * 複製前 ensureDir，逐檔 try/catch，失敗僅 warn 不崩；共用目錄已有檔則絕不覆蓋。
 */
const DATA_FILENAMES = ['ups.json', 'settings.json', 'state.json'] as const;

function resolveLegacyDataDirs(): string[] {
  // 排障覆寫（測試/驗證用，預設為空不影響正式行為）：路徑以 path.delimiter 分隔
  const override = process.env.BILI_LEGACY_DIRS;
  if (override) {
    return override.split(path.delimiter).map((d) => d.trim()).filter(Boolean);
  }
  const legacyDirs: string[] = [];
  const oldWebDir = path.resolve(__dirname, '../../data');
  if (oldWebDir !== DATA_DIR) legacyDirs.push(oldWebDir);
  // 舊 exe 版位置：Electron app.getPath('userData')，預設為 %APPDATA%/<productName>
  const appDataDir = process.env.APPDATA;
  if (appDataDir) {
    const oldExeDir = path.join(appDataDir, 'B站特別關注', 'data');
    if (oldExeDir !== DATA_DIR && !legacyDirs.includes(oldExeDir)) legacyDirs.push(oldExeDir);
  }
  // 非 Windows 平台的 userData 兜底位置
  const fallbackExeDir = path.join(os.homedir(), '.config', 'B站特別關注', 'data');
  if (fallbackExeDir !== DATA_DIR && !legacyDirs.includes(fallbackExeDir)) {
    legacyDirs.push(fallbackExeDir);
  }
  return legacyDirs;
}

// 單航班（single-flight）遷移：併發的 ensureDir 共用同一個 promise。
// 舊的布林旗標會讓後到的呼叫在遷移完成前直接跳過，進而建出空檔永久霸位。
let migrationPromise: Promise<void> | null = null;

export function migrateLegacyDataFiles(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((err) => {
      console.warn('[JsonStore] 舊檔自動遷移失敗（不影響啟動）:', err);
    });
  }
  return migrationPromise;
}

async function runMigration(): Promise<void> {
  if (!fsSync.existsSync(DATA_DIR)) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  const legacyDirs = resolveLegacyDataDirs();
  for (const filename of DATA_FILENAMES) {
    const targetFile = path.join(DATA_DIR, filename);
    if (readIfUsable(targetFile) !== null) continue;
    for (const legacyDir of legacyDirs) {
      const legacyFile = path.join(legacyDir, filename);
      const usable = readIfUsable(legacyFile);
      if (usable === null) continue;
      try {
        await fs.copyFile(legacyFile, targetFile);
        console.warn(`[JsonStore] 共用存檔已從 ${legacyFile} 遷移至 ${targetFile}`);
      } catch (err) {
        console.warn(`[JsonStore] 舊檔遷移失敗（不影響啟動）${legacyFile}:`, err);
      }
      break;
    }
  }
}

/**
 * 安全原子寫入機制：
 * 寫入暫存檔案 (.tmp) 後執行 rename 取代原檔，防止因斷電或崩潰造成 JSON 檔案損壞。
 * 在 Windows 系統處理可能的 EPERM / EBUSY 衝突。
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await ensureDir();
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  const content = JSON.stringify(data, null, 2);

  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    try {
      await fs.rename(tmpPath, filePath);
    } catch (renameErr: any) {
      // Windows 某些情況下如果目標檔案被鎖定，嘗試先刪除目標再重命名，或複製覆蓋
      if (renameErr.code === 'EPERM' || renameErr.code === 'EBUSY' || renameErr.code === 'EEXIST') {
        await fs.copyFile(tmpPath, filePath);
        await fs.unlink(tmpPath).catch(() => {});
      } else {
        throw renameErr;
      }
    }
  } catch (err) {
    if (fsSync.existsSync(tmpPath)) {
      await fs.unlink(tmpPath).catch(() => {});
    }
    throw new Error(`[JsonStore] 原子寫入失敗 (${filePath}): ${(err as Error).message}`);
  }
}

/**
 * 安全讀取 JSON 檔案，若檔案不存在則回傳 fallback。
 * 注意：ensureDir 內已等待遷移完成，此處重判 exists，避免覆蓋剛遷移好的檔案。
 */
async function safeReadJson<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDir();
  if (!fsSync.existsSync(filePath)) {
    await atomicWriteJson(filePath, fallback);
    return fallback;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[JsonStore] 讀取 JSON 失敗 (${filePath})，使用 fallback:`, err);
    return fallback;
  }
}

// 記憶體快取以提升吞吐量，並防止併發讀寫衝突
let memoryUps: UpUser[] | null = null;
let memorySettings: AppSettings | null = null;
let memoryState: PollerState | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(action: () => Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(action).catch((err) => {
    console.error('[JsonStore] 寫入佇列異常:', err);
  });
  return writeQueue;
}

/**
 * 等待寫入佇列排空（優雅退出 / /api/shutdown/flush 用）。
 * 回傳當下隊列尾端 promise；調用方 await 即保證此前所有 save* 已落盤。
 */
export function flushWrites(): Promise<void> {
  return writeQueue;
}

export const JsonStore = {
  async getUps(): Promise<UpUser[]> {
    if (memoryUps !== null) return memoryUps;
    memoryUps = await safeReadJson<UpUser[]>(UPS_FILE, []);
    return memoryUps;
  },

  async saveUps(ups: UpUser[]): Promise<void> {
    memoryUps = ups;
    return enqueueWrite(() => atomicWriteJson(UPS_FILE, ups));
  },

  async getSettings(): Promise<AppSettings> {
    if (memorySettings !== null) return memorySettings;
    const loaded = await safeReadJson<Partial<AppSettings>>(SETTINGS_FILE, DEFAULT_SETTINGS);
    memorySettings = { ...DEFAULT_SETTINGS, ...loaded };
    return memorySettings;
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    memorySettings = settings;
    return enqueueWrite(() => atomicWriteJson(SETTINGS_FILE, settings));
  },

  async getState(): Promise<PollerState> {
    if (memoryState !== null) return memoryState;
    const loaded = await safeReadJson<Partial<PollerState>>(STATE_FILE, DEFAULT_STATE);
    memoryState = { ...DEFAULT_STATE, ...loaded };
    return memoryState;
  },

  async saveState(state: PollerState): Promise<void> {
    memoryState = state;
    return enqueueWrite(() => atomicWriteJson(STATE_FILE, state));
  },

  async exportAll() {
    const ups = await this.getUps();
    const settings = await this.getSettings();
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      ups,
      settings
    };
  },

  async importAll(data: { ups?: UpUser[]; settings?: Partial<AppSettings> }) {
    if (Array.isArray(data.ups)) {
      await this.saveUps(data.ups);
    }
    if (data.settings) {
      const current = await this.getSettings();
      await this.saveSettings({ ...current, ...data.settings });
    }
    return { success: true, upsCount: data.ups?.length ?? 0 };
  }
};
