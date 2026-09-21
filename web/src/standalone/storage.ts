import type { UpUser, AppSettings, DynamicItem, LiveStatusInfo } from '../types/index.js';

const STORAGE_KEY_UPS = 'bili_standalone_ups';
const STORAGE_KEY_SETTINGS = 'bili_standalone_settings';
const STORAGE_KEY_FEED_CACHE = 'bili_standalone_feed_cache';
const STORAGE_KEY_LIVE_CACHE = 'bili_standalone_live_cache';

const DEFAULT_SETTINGS: AppSettings = {
  pollIntervalLiveSec: 30,
  pollIntervalDynamicSec: 60,
  enableNotifications: true,
  notifyLive: true,
  notifyVideo: true,
  notifyDynamic: true,
  soundEnabled: true,
  theme: 'dark'
};

export const standaloneStorage = {
  // UP 主資料
  getUps(): UpUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_UPS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveUps(ups: UpUser[]): void {
    localStorage.setItem(STORAGE_KEY_UPS, JSON.stringify(ups));
  },

  getUpByMid(mid: number): UpUser | undefined {
    return this.getUps().find((u) => u.mid === mid);
  },

  saveUp(up: UpUser): void {
    const ups = this.getUps();
    const index = ups.findIndex((u) => u.mid === up.mid);
    if (index >= 0) {
      ups[index] = up;
    } else {
      ups.push(up);
    }
    this.saveUps(ups);
  },

  removeUp(mid: number): boolean {
    const ups = this.getUps();
    const filtered = ups.filter((u) => u.mid !== mid);
    if (filtered.length !== ups.length) {
      this.saveUps(filtered);
      return true;
    }
    return false;
  },

  // 應用設定
  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const curr = this.getSettings();
    const updated = { ...curr, ...settings };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
    return updated;
  },

  // 動態快取
  getCachedFeed(): DynamicItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_FEED_CACHE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCachedFeed(items: DynamicItem[]): void {
    // 保留最新 300 則動態快取
    const trimmed = items.slice(0, 300);
    localStorage.setItem(STORAGE_KEY_FEED_CACHE, JSON.stringify(trimmed));
  },

  // 直播快取
  getCachedLive(): LiveStatusInfo[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_LIVE_CACHE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCachedLive(items: LiveStatusInfo[]): void {
    localStorage.setItem(STORAGE_KEY_LIVE_CACHE, JSON.stringify(items));
  },

  // 匯出 / 匯入
  exportData(): any {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      ups: this.getUps(),
      settings: this.getSettings()
    };
  },

  importData(data: any): { success: boolean; upsCount: number } {
    if (!data || !Array.isArray(data.ups)) {
      throw new Error('無效的備份檔案格式');
    }
    this.saveUps(data.ups);
    if (data.settings) {
      this.saveSettings(data.settings);
    }
    return { success: true, upsCount: data.ups.length };
  }
};
