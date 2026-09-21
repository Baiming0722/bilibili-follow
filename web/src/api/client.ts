import type { UpUser, DynamicItem, LiveStatusInfo, AppSettings, VideoItem } from '../types/index.js';
import { standaloneApi } from '../standalone/index.js';
import { isCapacitorNative } from '../standalone/biliClient.js';

const API_BASE = '/api';

/**
 * 檢測是否處於純獨立模式：
 * 1. 處於 Capacitor 原生環境 (Android 原生 APK)
 * 2. 使用者手動勾選或指定 standalone 模式
 * 3. 離線或後端服務不可達時自動降級
 */
let forceStandalone = isCapacitorNative();
try {
  const pref = localStorage.getItem('bili_force_standalone');
  if (pref !== null) {
    forceStandalone = pref === 'true';
  }
} catch {}

export function setStandaloneMode(enabled: boolean): void {
  forceStandalone = enabled;
  try {
    localStorage.setItem('bili_force_standalone', String(enabled));
  } catch {}
}

export function isStandaloneMode(): boolean {
  return forceStandalone || isCapacitorNative();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  const json = await res.json();
  if (json.code !== 0 && json.code !== undefined) {
    throw new Error(json.message || `請求失敗 (code: ${json.code})`);
  }
  return json.data !== undefined ? json.data : json;
}

export const api = {
  // UP 主管理
  async getUps(): Promise<UpUser[]> {
    if (isStandaloneMode()) {
      return standaloneApi.getUps();
    }
    try {
      return await fetchJson<UpUser[]>(`${API_BASE}/ups`);
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為本機 Standalone 儲存:', err);
      return standaloneApi.getUps();
    }
  },

  async addUp(input: string, extra?: { note?: string; tags?: string[]; isPinned?: boolean }): Promise<UpUser> {
    if (isStandaloneMode()) {
      return standaloneApi.addUp(input, extra);
    }
    try {
      return await fetchJson<UpUser>(`${API_BASE}/ups`, {
        method: 'POST',
        body: JSON.stringify({ input, ...extra })
      });
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 引擎新增:', err);
      return standaloneApi.addUp(input, extra);
    }
  },

  async removeUp(mid: number): Promise<{ success: boolean }> {
    if (isStandaloneMode()) {
      return standaloneApi.removeUp(mid);
    }
    try {
      return await fetchJson<{ success: boolean }>(`${API_BASE}/ups/${mid}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 刪除:', err);
      return standaloneApi.removeUp(mid);
    }
  },

  async updateUp(mid: number, updates: Partial<UpUser>): Promise<UpUser> {
    if (isStandaloneMode()) {
      return standaloneApi.updateUp(mid, updates);
    }
    try {
      return await fetchJson<UpUser>(`${API_BASE}/ups/${mid}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 更新:', err);
      return standaloneApi.updateUp(mid, updates);
    }
  },

  async getUpVideos(mid: number, pn = 1, ps = 30): Promise<{ list: VideoItem[]; total: number }> {
    if (isStandaloneMode()) {
      return standaloneApi.getUpVideos(mid, pn, ps);
    }
    try {
      return await fetchJson<{ list: VideoItem[]; total: number }>(`${API_BASE}/ups/${mid}/videos?pn=${pn}&ps=${ps}`);
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 獲取影片:', err);
      return standaloneApi.getUpVideos(mid, pn, ps);
    }
  },

  // 聚合動態
  async getFeed(params: { type?: string; keyword?: string; cursor?: number; limit?: number; mid?: number } = {}) {
    if (isStandaloneMode()) {
      return standaloneApi.getFeed(params);
    }
    try {
      const q = new URLSearchParams();
      if (params.type) q.append('type', params.type);
      if (params.keyword) q.append('keyword', params.keyword);
      if (params.cursor) q.append('cursor', String(params.cursor));
      if (params.limit) q.append('limit', String(params.limit));
      if (params.mid) q.append('mid', String(params.mid));
      return await fetchJson<{ items: DynamicItem[]; nextCursor: number | null; hasMore: boolean; total: number }>(
        `${API_BASE}/feed?${q.toString()}`
      );
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 獲取動態:', err);
      return standaloneApi.getFeed(params);
    }
  },

  // 直播間狀態
  async getLiveStatus(): Promise<LiveStatusInfo[]> {
    if (isStandaloneMode()) {
      return standaloneApi.getLiveStatus();
    }
    try {
      return await fetchJson<LiveStatusInfo[]>(`${API_BASE}/live`);
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 獲取直播:', err);
      return standaloneApi.getLiveStatus();
    }
  },

  // 應用設定
  async getSettings(): Promise<AppSettings> {
    if (isStandaloneMode()) {
      return standaloneApi.getSettings();
    }
    try {
      return await fetchJson<AppSettings>(`${API_BASE}/settings`);
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 設定:', err);
      return standaloneApi.getSettings();
    }
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    if (isStandaloneMode()) {
      return standaloneApi.updateSettings(settings);
    }
    try {
      return await fetchJson<AppSettings>(`${API_BASE}/settings`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 設定更新:', err);
      return standaloneApi.updateSettings(settings);
    }
  },

  // 手動全量更新
  async refreshAll(): Promise<{ liveChecked: boolean; dynamicChecked: boolean }> {
    if (isStandaloneMode()) {
      return standaloneApi.refreshAll();
    }
    try {
      return await fetchJson<{ liveChecked: boolean; dynamicChecked: boolean }>(`${API_BASE}/refresh`, {
        method: 'POST'
      });
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 刷新:', err);
      return standaloneApi.refreshAll();
    }
  },

  // 匯出 / 匯入
  async exportBackup(): Promise<any> {
    if (isStandaloneMode()) {
      return standaloneApi.exportBackup();
    }
    try {
      return await fetchJson<any>(`${API_BASE}/export`);
    } catch (err) {
      return standaloneApi.exportBackup();
    }
  },

  async importBackup(data: any): Promise<{ success: boolean; upsCount: number }> {
    if (isStandaloneMode()) {
      return standaloneApi.importBackup(data);
    }
    try {
      return await fetchJson<{ success: boolean; upsCount: number }>(`${API_BASE}/import`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (err) {
      return standaloneApi.importBackup(data);
    }
  },

  // 取得評論列表 (支援動態與影片；失敗時以 error 欄位攜帶原因，而非拋錯)
  async getComments(type: number, oid: string, page = 1, pageSize = 20): Promise<import('../types/index.js').CommentsResult> {
    if (isStandaloneMode()) {
      return standaloneApi.getComments(type, oid, page, pageSize);
    }
    try {
      const q = new URLSearchParams({
        type: String(type),
        oid: String(oid),
        page: String(page),
        pageSize: String(pageSize)
      });
      return await fetchJson<import('../types/index.js').CommentsResult>(
        `${API_BASE}/comments?${q.toString()}`
      );
    } catch (err) {
      console.warn('[API Client] 後端無法連線，平滑降級為 Standalone 獲取評論:', err);
      return standaloneApi.getComments(type, oid, page, pageSize);
    }
  }
};
