import { Router } from 'express';
import { FeedService } from '../services/feedService.js';
import { getComments } from '../bilibili/endpoints.js';
import type { DynamicType } from '../types/index.js';

export const feedRouter = Router();

// GET /api/feed - 聚合動態
feedRouter.get('/', async (req, res) => {
  try {
    const type = (req.query.type as DynamicType | 'all') || 'all';
    const keyword = req.query.keyword as string | undefined;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const mid = req.query.mid ? parseInt(req.query.mid as string, 10) : undefined;

    const result = await FeedService.getAggregatedFeed({
      type,
      keyword,
      cursor,
      limit,
      mid
    });

    res.json({ code: 0, message: 'ok', data: result });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// GET /api/feed/comments 或 GET /api/comments - 取得動態或影片評論區
feedRouter.get('/comments', async (req, res) => {
  try {
    const type = parseInt(req.query.type as string, 10) || 11;
    const oid = (req.query.oid as string) || '';
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

    if (!oid) {
      return res.status(400).json({ code: -1, message: '缺少必要參數 oid' });
    }

    const data = await getComments(type, oid, page, pageSize);
    res.json({ code: 0, message: 'ok', data });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});
