import { JsonStore } from '../store/jsonStore.js';
import { getUpInfo, resolveUp, getLiveStatusBatch } from '../bilibili/endpoints.js';
import type { UpUser } from '../types/index.js';

export const UpService = {
  /**
   * 取得所有關注的 UP 主，並按置頂優先、更新時間排序
   */
  async getAllUps(): Promise<UpUser[]> {
    const ups = await JsonStore.getUps();
    return ups.sort((a, b) => {
      // 置頂優先
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (a.isPinned && b.isPinned) {
        return (a.pinOrder ?? 0) - (b.pinOrder ?? 0);
      }
      // 否則依據創建或更新時間降序
      return b.updatedAt - a.updatedAt;
    });
  },

  /**
   * 根據 mid 獲取單個關注 UP
   */
  async getUpByMid(mid: number): Promise<UpUser | undefined> {
    const ups = await JsonStore.getUps();
    return ups.find((u) => u.mid === mid);
  },

  /**
   * 新增關注 UP 主 (支援 mid, space 網址, b23.tv 短網址, BV 號)
   */
  async addUp(input: string, customData?: { note?: string; tags?: string[]; isPinned?: boolean }): Promise<UpUser> {
    // 1. 解析輸入
    const resolved = await resolveUp(input);
    const mid = resolved.mid;

    // 2. 檢查是否已經存在
    const ups = await JsonStore.getUps();
    const existingIndex = ups.findIndex((u) => u.mid === mid);

    // 3. 獲取 B 站最新資料
    const info = await getUpInfo(mid);
    const now = Date.now();

    const newUp: UpUser = {
      mid: info.mid,
      name: info.name,
      face: info.face,
      sign: info.sign || '',
      sex: info.sex || '保密',
      level: info.level || 0,
      official: info.official ? {
        role: info.official.role,
        title: info.official.title,
        desc: info.official.desc,
        type: info.official.type
      } : undefined,
      liveRoom: info.live_room ? {
        roomStatus: info.live_room.roomStatus,
        liveStatus: info.live_room.liveStatus,
        url: info.live_room.url,
        title: info.live_room.title,
        cover: info.live_room.cover,
        online: info.live_room.online,
        roomid: info.live_room.roomid,
        roundStatus: info.live_room.roundStatus,
        broadcastType: info.live_room.broadcastType
      } : undefined,
      customNote: customData?.note ?? (existingIndex >= 0 ? ups[existingIndex].customNote : ''),
      tags: customData?.tags ?? (existingIndex >= 0 ? ups[existingIndex].tags : []),
      isPinned: customData?.isPinned ?? (existingIndex >= 0 ? ups[existingIndex].isPinned : false),
      pinOrder: existingIndex >= 0 ? ups[existingIndex].pinOrder : 0,
      notifyOnLive: existingIndex >= 0 ? ups[existingIndex].notifyOnLive ?? true : true,
      notifyOnVideo: existingIndex >= 0 ? ups[existingIndex].notifyOnVideo ?? true : true,
      notifyOnDynamic: existingIndex >= 0 ? ups[existingIndex].notifyOnDynamic ?? true : true,
      createdAt: existingIndex >= 0 ? ups[existingIndex].createdAt : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      ups[existingIndex] = newUp;
    } else {
      ups.unshift(newUp);
    }

    await JsonStore.saveUps(ups);
    return newUp;
  },

  /**
   * 移除關注 UP 主
   */
  async removeUp(mid: number): Promise<boolean> {
    const ups = await JsonStore.getUps();
    const filtered = ups.filter((u) => u.mid !== mid);
    if (filtered.length === ups.length) {
      return false;
    }
    await JsonStore.saveUps(filtered);
    return true;
  },

  /**
   * 修改 UP 主設定 (置頂、備註、標籤、通知開關)
   */
  async updateUp(
    mid: number,
    updates: Partial<Pick<UpUser, 'customNote' | 'tags' | 'isPinned' | 'pinOrder' | 'notifyOnLive' | 'notifyOnVideo' | 'notifyOnDynamic'>>
  ): Promise<UpUser> {
    const ups = await JsonStore.getUps();
    const index = ups.findIndex((u) => u.mid === mid);
    if (index === -1) {
      throw new Error(`找不到 mid 為 ${mid} 的 UP 主`);
    }

    const current = ups[index];
    const updated: UpUser = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };

    ups[index] = updated;
    await JsonStore.saveUps(ups);
    return updated;
  },

  /**
   * 刷新所有或單個 UP 主的最新基本資料與直播狀態
   */
  async refreshAllUps(): Promise<UpUser[]> {
    const ups = await JsonStore.getUps();
    if (ups.length === 0) return [];

    const uids = ups.map((u) => u.mid);
    // 批次查詢直播狀態
    const liveMap = await getLiveStatusBatch(uids);

    const updatedUps: UpUser[] = [];

    // 並行更新每個 UP 主資訊 (設定併發限制以避免觸發風控)
    for (const up of ups) {
      try {
        const liveInfo = liveMap[up.mid];
        let updatedLiveRoom = up.liveRoom;

        if (liveInfo) {
          updatedLiveRoom = {
            roomStatus: liveInfo.room_id ? 1 : 0,
            liveStatus: liveInfo.live_status,
            url: `https://live.bilibili.com/${liveInfo.room_id}`,
            title: liveInfo.title,
            cover: liveInfo.cover_from_user || liveInfo.keyframe,
            online: liveInfo.online,
            roomid: liveInfo.room_id,
            roundStatus: 0,
            broadcastType: 0
          };
        }

        updatedUps.push({
          ...up,
          liveRoom: updatedLiveRoom,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn(`[UpService] 刷新 UP ${up.mid} 異常，保留既有資料:`, err);
        updatedUps.push(up);
      }
    }

    await JsonStore.saveUps(updatedUps);
    return updatedUps;
  }
};
