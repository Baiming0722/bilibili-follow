import { Router } from 'express';
import { UpService } from '../services/upService.js';
import { getUpVideos } from '../bilibili/endpoints.js';

export const upRouter = Router();

// GET /api/ups - 取得所有關注 UP 主列表
upRouter.get('/', async (_req, res) => {
  try {
    const list = await UpService.getAllUps();
    res.json({ code: 0, message: 'ok', data: list });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/ups - 新增關注 UP 主 (支援 UID, URL, b23.tv, BV)
upRouter.post('/', async (req, res) => {
  try {
    const { input, note, tags, isPinned } = req.body;
    if (!input || typeof input !== 'string') {
      res.status(400).json({ code: 400, message: '請提供 UP 主識別字串 (input)' });
      return;
    }
    const up = await UpService.addUp(input, { note, tags, isPinned });
    res.json({ code: 0, message: '關注成功', data: up });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
});

// DELETE /api/ups/:mid - 取消關注
upRouter.delete('/:mid', async (req, res) => {
  try {
    const mid = parseInt(req.params.mid, 10);
    if (isNaN(mid)) {
      res.status(400).json({ code: 400, message: '無效的 mid' });
      return;
    }
    const success = await UpService.removeUp(mid);
    res.json({ code: 0, message: success ? '已取消關注' : '未找到此 UP 主', data: { success } });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// PATCH /api/ups/:mid - 更新 UP 主資訊 (置頂、備註、標籤、通知設置)
upRouter.patch('/:mid', async (req, res) => {
  try {
    const mid = parseInt(req.params.mid, 10);
    if (isNaN(mid)) {
      res.status(400).json({ code: 400, message: '無效的 mid' });
      return;
    }
    const updated = await UpService.updateUp(mid, req.body);
    res.json({ code: 0, message: '更新成功', data: updated });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
});

// GET /api/ups/:mid/videos - 取得單一 UP 主最新影片列表
upRouter.get('/:mid/videos', async (req, res) => {
  try {
    const mid = parseInt(req.params.mid, 10);
    if (isNaN(mid)) {
      res.status(400).json({ code: 400, message: '無效的 mid' });
      return;
    }
    const pn = parseInt(req.query.pn as string, 10) || 1;
    const ps = parseInt(req.query.ps as string, 10) || 30;
    const order = (req.query.order as string) || 'pubdate';

    const result = await getUpVideos(mid, pn, ps, order);
    res.json({ code: 0, message: 'ok', data: result });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});
