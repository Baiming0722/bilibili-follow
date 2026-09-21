import { UpService } from './upService.js';
import { getLiveStatusBatch } from '../bilibili/endpoints.js';
import type { LiveStatusInfo } from '../types/index.js';

export const LiveService = {
  /**
   * 批次取得所有關注中 UP 主的最新直播間狀態
   */
  async getAllLiveStatus(): Promise<LiveStatusInfo[]> {
    const ups = await UpService.getAllUps();
    if (ups.length === 0) return [];

    const uids = ups.map((u) => u.mid);
    const liveMap = await getLiveStatusBatch(uids);

    const list: LiveStatusInfo[] = [];

    for (const up of ups) {
      const info = liveMap[up.mid];
      if (info) {
        list.push({
          ...info,
          uname: up.name,
          face: up.face
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

    // 將「正在直播中 (live_status === 1)」排在最前面，其餘依在線人數排
    return list.sort((a, b) => {
      if (a.live_status === 1 && b.live_status !== 1) return -1;
      if (a.live_status !== 1 && b.live_status === 1) return 1;
      return b.online - a.online;
    });
  }
};
