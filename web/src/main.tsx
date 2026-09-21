import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.js';

// 註冊 PWA Service Worker（Electron / file:// 下跳過：無需離線快取且 sw 會干擾同源載入）
const isElectron = navigator.userAgent.includes('Electron');
if (
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production' &&
  window.location.protocol.startsWith('http') &&
  !isElectron
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker 註冊成功:', reg.scope);
      })
      .catch((err) => {
        console.error('[PWA] Service Worker 註冊失敗:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
