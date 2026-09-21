import type { UpUser, DynamicItem, LiveStatusInfo, AppSettings, VideoItem } from '../types/index.js';
import { standaloneStorage } from './storage.js';
import {
  resolveUp,
  getUpInfo,
  getUpVideos,
  getUpDynamics,
  getLiveStatusBatch,
  getComments
} from './endpoints.js';

export const standaloneApi = {
  // UP 主管理
  async getUps(): Promise<UpUser[]> {
    return standaloneStorage.getUps();
  },

  async addUp(input: string, extra?: { note?: string; tags?: string[]; isPinned?: boolean }): Promise<UpUser> {
    const resolved = await resolveUp(input);
    const existing = standaloneStorage.getUpByMid(resolved.mid);
    if (existing) {
      throw new Error(`UP 主 "${existing.name}" (UID: ${existing.mid}) 已經在特別關注列表中`);
    }

    const info = await getUpInfo(resolved.mid);
    const now = Date.now();

    const upUser: UpUser = {
      mid: info.mid,
      name: info.name,
      face: info.face,
      sign: info.sign || '',
      sex: info.sex || '保密',
      level: info.level || 0,
      official: info.official,
      liveRoom: info.live_room,
      customNote: extra?.note || '',
      tags: extra?.tags || [],
      isPinned: extra?.isPinned || false,
      pinOrder: extra?.isPinned ? 1 : 0,
      notifyOnLive: true,
      notifyOnVideo: true,
      notifyOnDynamic: true,
      createdAt: now,
      updatedAt: now
    };

    standaloneStorage.saveUp(upUser);
    return upUser;
  },

  async removeUp(mid: number): Promise<{ success: boolean }> {
    const removed = standaloneStorage.removeUp(mid);
    return { success: removed };
  },

  async updateUp(mid: number, updates: Partial<UpUser>): Promise<UpUser> {
    const up = standaloneStorage.getUpByMid(mid);
    if (!up) {
      throw new Error(`找不到 mid 為 ${mid} 的 UP 主`);
    }
    const updated: UpUser = {
      ...up,
      ...updates,
      updatedAt: Date.now()
    };
    standaloneStorage.saveUp(updated);
    return updated;
  },

  async getUpVideos(mid: number, pn = 1, ps = 30): Promise<{ list: VideoItem[]; total: number }> {
    return await getUpVideos(mid, pn, ps);
  },

  // 取得評論列表
  async getComments(type: number, oid: string, page = 1, pageSize = 20) {
    return await getComments(type, oid, page, pageSize);
  },

  // 聚合動態
  async getFeed(params: { type?: string; keyword?: string; cursor?: number; limit?: number; mid?: number } = {}) {
    const ups = standaloneStorage.getUps();
    const targetUps = params.mid ? ups.filter((u) => u.mid === params.mid) : ups;

    if (targetUps.length === 0) {
      return { items: [], nextCursor: null, hasMore: false, total: 0 };
    }

    let allItems: DynamicItem[] = [];

    // 若從快取讀取
    const cachedFeed = standaloneStorage.getCachedFeed();
    if (cachedFeed.length > 0) {
      allItems = cachedFeed;
    } else {
      // 即時從各 UP 主空間取得最新動態 (併發)
      const feedPromises = targetUps.map(async (u) => {
        try {
          const res = await getUpDynamics(u.mid);
          return res.items;
        } catch {
          return [];
        }
      });
      const results = await Promise.all(feedPromises);
      allItems = results.flat();
      allItems.sort((a, b) => b.pubTime - a.pubTime);
      standaloneStorage.saveCachedFeed(allItems);
    }

    // 補齊作者頭像與暱稱資訊，並校正協議前綴
    const upMap = new Map(ups.map((u) => [u.mid, u]));
    for (const item of allItems) {
      const up = upMap.get(item.mid);
      if (up) {
        if (!item.authorFace || item.authorFace.trim() === '') {
          item.authorFace = up.face || '';
        }
        if (!item.authorName || item.authorName.trim() === '') {
          item.authorName = up.name;
        }
      }
      if (item.authorFace && item.authorFace.startsWith('//')) {
        item.authorFace = `https:${item.authorFace}`;
      }
      if (item.cover && item.cover.startsWith('//')) {
        item.cover = `https:${item.cover}`;
      }
    }

    // 篩選與過濾
    let filtered = allItems;
    if (params.mid) {
      filtered = filtered.filter((i) => i.mid === params.mid);
    }
    if (params.type && params.type !== 'all') {
      filtered = filtered.filter((i) => i.type === params.type);
    }
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          (i.title && i.title.toLowerCase().includes(kw)) ||
          (i.text && i.text.toLowerCase().includes(kw)) ||
          i.authorName.toLowerCase().includes(kw)
      );
    }

    const limit = params.limit || 20;
    const cursor = params.cursor || 0;
    const paginated = filtered.slice(cursor, cursor + limit);
    const hasMore = cursor + limit < filtered.length;
    const nextCursor = hasMore ? cursor + limit : null;

    return {
      items: paginated,
      nextCursor,
      hasMore,
      total: filtered.length
    };
  },

  // 直播間狀態
  async getLiveStatus(): Promise<LiveStatusInfo[]> {
    const ups = standaloneStorage.getUps();
    if (ups.length === 0) return [];

    const uids = ups.map((u) => u.mid);
    const liveMap = await getLiveStatusBatch(uids);

    const list: LiveStatusInfo[] = [];
    for (const up of ups) {
      const status = liveMap[up.mid];
      if (status) {
        list.push({
          ...status,
          uname: status.uname || up.name,
          face: status.face || up.face
        });
      } else if (up.liveRoom) {
        list.push({
          uid: up.mid,
          room_id: up.liveRoom.roomid,
          title: up.liveRoom.title,
          cover_from_user: up.liveRoom.cover,
          keyframe: up.liveRoom.cover,
          live_status: up.liveRoom.liveStatus,
          live_time: '',
          online: up.liveRoom.online,
          area_name: '',
          parent_area_name: '',
          uname: up.name,
          face: up.face
        });
      }
    }

    // 依開播中優先排序
    list.sort((a, b) => (b.live_status === 1 ? 1 : 0) - (a.live_status === 1 ? 1 : 0));
    standaloneStorage.saveCachedLive(list);
    return list;
  },

  // 應用設定
  async getSettings(): Promise<AppSettings> {
    return standaloneStorage.getSettings();
  },

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    return standaloneStorage.saveSettings(settings);
  },

  // 手動全量更新 (直接重刷動態與直播)
  async refreshAll(): Promise<{ liveChecked: boolean; dynamicChecked: boolean }> {
    const ups = standaloneStorage.getUps();
    if (ups.length > 0) {
      // 1. 刷新直播
      const uids = ups.map((u) => u.mid);
      const liveMap = await getLiveStatusBatch(uids);
      const liveList = Object.values(liveMap);
      standaloneStorage.saveCachedLive(liveList);

      // 2. 刷新動態
      const feedPromises = ups.map(async (u) => {
        try {
          const res = await getUpDynamics(u.mid);
          return res.items;
        } catch {
          return [];
        }
      });
      const results = await Promise.all(feedPromises);
      const allItems = results.flat();
      allItems.sort((a, b) => b.pubTime - a.pubTime);
      standaloneStorage.saveCachedFeed(allItems);
    }
    return { liveChecked: true, dynamicChecked: true };
  },

  // 匯出 / 匯入
  async exportBackup(): Promise<any> {
    return standaloneStorage.exportData();
  },

  async importBackup(data: any): Promise<{ success: boolean; upsCount: number }> {
    return standaloneStorage.importData(data);
  }
};
