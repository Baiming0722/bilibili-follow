import type { Response } from 'express';
import { JsonStore } from './store/jsonStore.js';
import { UpService } from './services/upService.js';
import { getLiveStatusBatch, getUpDynamics, getUpVideos } from './bilibili/endpoints.js';
import type { SSEEvent } from './types/index.js';

// 連線中的 SSE 客戶端集合
const clients = new Set<Response>();

export function registerSSEClient(res: Response): void {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

/**
 * 對所有 SSE 客戶端廣播事件
 */
export function broadcastEvent(event: SSEEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

class BackgroundPoller {
  private liveTimer: NodeJS.Timeout | null = null;
  private dynamicTimer: NodeJS.Timeout | null = null;
  private isPollingLive = false;
  private isPollingDynamic = false;

  async start(): Promise<void> {
    const settings = await JsonStore.getSettings();
    const liveSec = Math.max(settings.pollIntervalLiveSec || 60, 30);
    const dynamicSec = Math.max(settings.pollIntervalDynamicSec || 300, 60);

    console.log(`[Poller] 啟動背景輪詢: 直播每 ${liveSec}s，動態每 ${dynamicSec}s`);

    // 啟動時立刻執行一次檢查
    this.pollLive().catch((e) => console.error('[Poller] 初始直播輪詢出錯:', e));
    this.pollDynamic().catch((e) => console.error('[Poller] 初始動態輪詢出錯:', e));

    this.liveTimer = setInterval(() => this.pollLive(), liveSec * 1000);
    this.dynamicTimer = setInterval(() => this.pollDynamic(), dynamicSec * 1000);
  }

  stop(): void {
    if (this.liveTimer) clearInterval(this.liveTimer);
    if (this.dynamicTimer) clearInterval(this.dynamicTimer);
    this.liveTimer = null;
    this.dynamicTimer = null;
    console.log('[Poller] 背景輪詢已停止');
  }

  /**
   * 直播狀態批次輪詢 (每 60s)
   */
  async pollLive(): Promise<void> {
    if (this.isPollingLive) return;
    this.isPollingLive = true;

    try {
      const ups = await UpService.getAllUps();
      if (ups.length === 0) return;

      const uids = ups.map((u) => u.mid);
      const liveMap = await getLiveStatusBatch(uids);
      const state = await JsonStore.getState();
      const currentLiveUids = new Set<number>(state.knownLiveUids || []);
      const newLiveUids: number[] = [];

      for (const up of ups) {
        const liveInfo = liveMap[up.mid];
        if (!liveInfo) continue;

        const isStreaming = liveInfo.live_status === 1;
        const wasStreaming = currentLiveUids.has(up.mid);

        if (isStreaming) {
          newLiveUids.push(up.mid);
          // 新開播通知
          if (!wasStreaming && up.notifyOnLive !== false) {
            console.log(`[Poller] UP 主「${up.name}」開播了！標題: ${liveInfo.title}`);
            broadcastEvent({
              type: 'live_start',
              data: {
                mid: up.mid,
                uname: up.name,
                face: up.face,
                title: liveInfo.title,
                roomId: liveInfo.room_id,
                cover: liveInfo.cover_from_user || liveInfo.keyframe,
                areaName: liveInfo.area_name
              },
              timestamp: Date.now()
            });
          }
        } else if (wasStreaming) {
          // 下播通知
          broadcastEvent({
            type: 'live_end',
            data: { mid: up.mid, uname: up.name },
            timestamp: Date.now()
          });
        }
      }

      state.knownLiveUids = newLiveUids;
      state.lastLiveCheckTime = Date.now();
      await JsonStore.saveState(state);
    } catch (err) {
      console.error('[Poller] 輪詢直播狀態異常:', err);
    } finally {
      this.isPollingLive = false;
    }
  }

  /**
   * 動態與新影片增量比對 (每 5 分鐘)
   */
  async pollDynamic(): Promise<void> {
    if (this.isPollingDynamic) return;
    this.isPollingDynamic = true;

    try {
      const ups = await UpService.getAllUps();
      if (ups.length === 0) return;

      const state = await JsonStore.getState();
      state.knownDynamicIds = state.knownDynamicIds || {};
      state.knownVideoBvids = state.knownVideoBvids || {};

      for (const up of ups) {
        const midStr = String(up.mid);
        const knownDyns = new Set<string>(state.knownDynamicIds[midStr] || []);
        const knownBvs = new Set<string>(state.knownVideoBvids[midStr] || []);

        try {
          // 抓取該 UP 最新空間動態
          const dynamics = await getUpDynamics(up.mid);
          const isInitialRun = knownDyns.size === 0;

          for (const item of dynamics.items) {
            if (!knownDyns.has(item.id_str)) {
              knownDyns.add(item.id_str);

              // 第一次載入不發送通知，避免塞車
              if (!isInitialRun) {
                if (item.type === 'video' && up.notifyOnVideo !== false) {
                  broadcastEvent({
                    type: 'new_video',
                    data: {
                      mid: up.mid,
                      uname: up.name,
                      bvid: item.bvid,
                      title: item.title,
                      cover: item.cover,
                      id_str: item.id_str
                    },
                    timestamp: Date.now()
                  });
                } else if (up.notifyOnDynamic !== false) {
                  broadcastEvent({
                    type: 'new_dynamic',
                    data: {
                      mid: up.mid,
                      uname: up.name,
                      type: item.type,
                      title: item.title || item.text,
                      id_str: item.id_str
                    },
                    timestamp: Date.now()
                  });
                }
              }
            }

            if (item.bvid) {
              knownBvs.add(item.bvid);
            }
          }

          // 保存最近 50 個 ID 防止無限制膨脹
          state.knownDynamicIds[midStr] = Array.from(knownDyns).slice(-50);
          state.knownVideoBvids[midStr] = Array.from(knownBvs).slice(-50);
        } catch (upErr) {
          console.warn(`[Poller] 輪詢 UP ${up.mid} (${up.name}) 動態失敗:`, upErr);
        }

        // 間隔 500ms 避免太頻繁發起請求
        await new Promise((r) => setTimeout(r, 500));
      }

      state.lastDynamicCheckTime = Date.now();
      await JsonStore.saveState(state);
    } catch (err) {
      console.error('[Poller] 輪詢動態異常:', err);
    } finally {
      this.isPollingDynamic = false;
    }
  }

  /**
   * 手動立即觸發全量檢查
   */
  async triggerImmediateCheck(): Promise<{ liveChecked: boolean; dynamicChecked: boolean }> {
    await this.pollLive();
    await this.pollDynamic();
    return { liveChecked: true, dynamicChecked: true };
  }
}

export const poller = new BackgroundPoller();
