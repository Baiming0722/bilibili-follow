import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { upRouter } from './routes/upRoutes.js';
import { feedRouter } from './routes/feedRoutes.js';
import { liveRouter } from './routes/liveRoutes.js';
import { eventRouter } from './routes/eventRoutes.js';
import { settingsRouter } from './routes/settingsRoutes.js';
import { backupRouter } from './routes/backupRoutes.js';
import { getComments } from './bilibili/endpoints.js';
import { migrateLegacyDataFiles, flushWrites, getDataDir } from './store/jsonStore.js';
import { poller } from './poller.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.warn(`[Server] DATA_DIR=${getDataDir()}`);

// 舊檔自動遷移：必須在 listen 之前完成，否則首批請求/poller 的 safeReadJson
// 會先建出空檔，導致遷移看到目標已存在而跳過（空檔永久霸位）。
try {
  await migrateLegacyDataFiles();
} catch (err) {
  console.warn('[JsonStore] 舊檔自動遷移失敗（不影響啟動）:', err);
}

// 中間件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康檢查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// 優雅關閉排空端點（Electron 退出前調用）：等待寫入佇列落盤後再回 200，
// 主進程隨後發 SIGTERM/kill；Windows 下 kill 無法觸發信號處理，此端點是主要保障。
app.post('/api/shutdown/flush', async (_req, res) => {
  try {
    await flushWrites();
    res.json({ code: 0, message: 'flushed' });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// 註冊業務路由
app.use('/api/ups', upRouter);
app.use('/api/feed', feedRouter);
app.use('/api/live', liveRouter);
app.use('/api/events', eventRouter);
app.use('/api/settings', settingsRouter);
app.use('/api', backupRouter);

// GET /api/comments 路由代理 (方便前端調用)
app.get('/api/comments', async (req, res) => {
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

// 統一錯誤處理
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] 未捕獲例外:', err);
  res.status(err.status || 500).json({
    code: err.code || -1,
    message: err.message || '伺服器內部錯誤'
  });
});

// 託管前端靜態資源（Electron 同源模式）：僅當 web/dist 存在時掛載，
// /api/* 路由優先（已在上方註冊，不受靜態中間件影響）。
// asar 打包後 __dirname 指向 resources/app.asar/server/dist，
// resolve 後即為 resources/app.asar/web/dist，路徑解析內外一致。
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistDir = path.resolve(__dirname, '../../web/dist');
if (fsSync.existsSync(webDistDir)) {
  app.use(
    express.static(webDistDir, {
      // index.html 永不快取（保證 Electron 更新後即時生效），其餘靜態走長快取
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    })
  );
  // SPA fallback：僅非 /api 的 GET 請求回 index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDistDir, 'index.html'));
  });
}

// 啟動 HTTP 伺服器並初始化背景輪詢
const server = app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(` Bilibili 特別關注後端核心引擎已啟動`);
  console.log(` 監聽端口: http://localhost:${PORT}`);
  console.log(`========================================`);

  poller.start().catch((err) => {
    console.error('[Poller] 啟動失敗:', err);
  });
});

// 端口衝突時給出明確警告（Electron 單例模式下通常意味著已有實例在運行）
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[Server] 端口 ${PORT} 已被佔用，可能已有實例在運行。`);
    return;
  }
  throw err;
});

// 優雅退出：排空寫入佇列並關閉 HTTP 服務後再結束進程，
// 保證關窗進托盤→托盤退出鏈路中最後幾筆寫入不丟。
let isShuttingDown = false;
function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.warn(`[Server] 收到 ${signal}，排空寫入後退出…`);
  (async () => {
    try {
      await flushWrites();
    } catch (err) {
      console.warn('[Server] 退出前排空寫入異常:', err);
    }
    server.close(() => {
      process.exit(0);
    });
    // server.close 保底：3s 內未關完直接退出（寫入已排空，安全）
    setTimeout(() => process.exit(0), 3000).unref();
  })();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
