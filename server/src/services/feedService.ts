import { getUpDynamics } from '../bilibili/endpoints.js';
import { UpService } from './upService.js';
import type { DynamicItem, DynamicType } from '../types/index.js';

interface FeedCacheEntry {
  items: DynamicItem[];
  fetchedAt: number;
}

const FEED_CACHE_TTL = 90 * 1000; // 90 秒動態快取
const feedMemoryCache = new Map<number, FeedCacheEntry>();

export interface FeedQueryOptions {
  type?: DynamicType | 'all';
  keyword?: string;
  cursor?: number; // 時間戳分頁游標
  limit?: number;  // 預設 20
  mid?: number;    // 指定 UP 主
}

export const FeedService = {
  /**
   * 聚合所有關注 UP 主的最新動態
   */
  async getAggregatedFeed(options: FeedQueryOptions = {}): Promise<{
    items: DynamicItem[];
    nextCursor: number | null;
    hasMore: boolean;
    total: number;
  }> {
    const { type = 'all', keyword, cursor, limit = 20, mid } = options;

    let targetMids: number[] = [];
    if (mid) {
      targetMids = [mid];
    } else {
      const allUps = await UpService.getAllUps();
      targetMids = allUps.map((u) => u.mid);
    }

    if (targetMids.length === 0) {
      return { items: [], nextCursor: null, hasMore: false, total: 0 };
    }

    // 併發拉取所有 UP 主的動態 (帶記憶體快取)
    const now = Date.now();
    const fetchPromises = targetMids.map(async (targetMid) => {
      const cached = feedMemoryCache.get(targetMid);
      if (cached && now - cached.fetchedAt < FEED_CACHE_TTL) {
        return cached.items;
      }

      try {
        const { items } = await getUpDynamics(targetMid);
        feedMemoryCache.set(targetMid, {
          items,
          fetchedAt: now
        });
        return items;
      } catch (err) {
        console.warn(`[FeedService] 獲取 UP ${targetMid} 動態失敗:`, err);
        return cached?.items || [];
      }
    });

    const results = await Promise.all(fetchPromises);
    let allItems: DynamicItem[] = results.flat();

    // 依發布時間倒序排序 (最新在前)
    allItems.sort((a, b) => b.pubTime - a.pubTime);

    // 補齊作者頭像與暱稱資訊，並校正協議前綴
    const allUps = await UpService.getAllUps();
    const upMap = new Map(allUps.map((u) => [u.mid, u]));
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

    // 篩選類型
    if (type && type !== 'all') {
      allItems = allItems.filter((item) => item.type === type);
    }

    // 關鍵字搜尋 (包含文字、標題、作者名稱)
    if (keyword && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      allItems = allItems.filter((item) => {
        const textMatch = item.text?.toLowerCase().includes(kw);
        const titleMatch = item.title?.toLowerCase().includes(kw);
        const authorMatch = item.authorName?.toLowerCase().includes(kw);
        return textMatch || titleMatch || authorMatch;
      });
    }

    // 游標分頁 (cursor 為上一頁最後一筆的 pubTime)
    if (cursor) {
      allItems = allItems.filter((item) => item.pubTime < cursor);
    }

    const total = allItems.length;
    const pageItems = allItems.slice(0, limit);
    const hasMore = total > limit;
    const nextCursor = hasMore && pageItems.length > 0 ? pageItems[pageItems.length - 1].pubTime : null;

    return {
      items: pageItems,
      nextCursor,
      hasMore,
      total
    };
  },

  /**
   * 手動清除快取
   */
  invalidateCache() {
    feedMemoryCache.clear();
  }
};
