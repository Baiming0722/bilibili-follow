import { Router } from 'express';
import { JsonStore } from '../store/jsonStore.js';

export const backupRouter = Router();

// GET /api/export - 導出所有資料
backupRouter.get('/export', async (_req, res) => {
  try {
    const data = await JsonStore.exportAll();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bilibili_follow_backup_${Date.now()}.json"`);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/import - 匯入備份資料
backupRouter.post('/import', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (!payload.ups && !payload.settings)) {
      res.status(400).json({ code: 400, message: '無效的備份資料格式' });
      return;
    }
    const result = await JsonStore.importAll(payload);
    res.json({ code: 0, message: '匯入成功', data: result });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});
