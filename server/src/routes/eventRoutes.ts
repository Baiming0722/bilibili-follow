import { Router } from 'express';
import { registerSSEClient } from '../poller.js';

export const eventRouter = Router();

// GET /api/events - Server-Sent Events (SSE) 即時推播端點
eventRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  // 發送初始連接成功訊息
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  // 心跳定時器防止中斷
  const keepAliveTimer = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  registerSSEClient(res);

  req.on('close', () => {
    clearInterval(keepAliveTimer);
  });
});
