import { Router } from 'express';
import { JsonStore } from '../store/jsonStore.js';
import { poller } from '../poller.js';

export const settingsRouter = Router();

// GET /api/settings - 讀取應用設定
settingsRouter.get('/', async (_req, res) => {
  try {
    const settings = await JsonStore.getSettings();
    res.json({ code: 0, message: 'ok', data: settings });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// PUT /api/settings - 更新應用設定
settingsRouter.put('/', async (req, res) => {
  try {
    const current = await JsonStore.getSettings();
    const updated = { ...current, ...req.body };
    await JsonStore.saveSettings(updated);
    res.json({ code: 0, message: '設定已儲存', data: updated });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/refresh - 手動觸發全量強制更新
settingsRouter.post('/refresh', async (_req, res) => {
  try {
    const result = await poller.triggerImmediateCheck();
    res.json({ code: 0, message: '已觸發全量更新', data: result });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});
