import { Router } from 'express';
import { LiveService } from '../services/liveService.js';

export const liveRouter = Router();

// GET /api/live - 取得所有關注 UP 的直播間狀態
liveRouter.get('/', async (_req, res) => {
  try {
    const list = await LiveService.getAllLiveStatus();
    res.json({ code: 0, message: 'ok', data: list });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});
