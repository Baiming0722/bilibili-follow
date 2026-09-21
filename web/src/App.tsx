import { useEffect, useState } from 'react';
import { 
  Tv, 
  Film, 
  Radio, 
  Settings, 
  RefreshCw, 
  Compass
} from 'lucide-react';
import { api } from './api/client.js';
import type { UpUser, LiveStatusInfo } from './types/index.js';
import { ToastContainer, ToastItem } from './components/ToastContainer.js';
import { SpatialBackground } from './components/SpatialBackground.js';
import { SpatialHUD } from './components/SpatialHUD.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { FeedView } from './views/FeedView.js';
import { VideosView } from './views/VideosView.js';
import { LiveView } from './views/LiveView.js';
import { SettingsView } from './views/SettingsView.js';

type ActiveView = 'feed' | 'videos' | 'live' | 'settings';

export function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'videos' || v === 'live' || v === 'settings') return v;
    return 'feed';
  });

  const [ups, setUps] = useState<UpUser[]>([]);
  const [liveList, setLiveList] = useState<LiveStatusInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 視圖兩階段切換：activeView 變化時先給舊視圖播放 180ms 退場，再掛載新視圖
  const [displayView, setDisplayView] = useState<ActiveView>(activeView);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (activeView === displayView) return;
    setIsExiting(true);
    const timer = setTimeout(() => {
      setDisplayView(activeView);
      setIsExiting(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [activeView, displayView]);

  // 觸覺震動回饋 (Haptic Feedback)
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // ignore
      }
    }
  };

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 全量資料載入
  const loadInitialData = async () => {
    try {
      setRefreshing(true);
      const [upsData, liveData] = await Promise.all([
        api.getUps().catch(() => []),
        api.getLiveStatus().catch(() => [])
      ]);
      setUps(upsData);
      setLiveList(liveData);
    } catch (err) {
      console.error('資料更新失敗:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // 建立 SSE 連線（連線失敗時靜默，不阻塞主流程）
    const es = new EventSource('/api/events');
    es.onerror = () => {
      // 靜默：後端未就緒 / 離線 / 打包環境下不輸出噪音，主動關閉避免無限重連
      es.close();
    };
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'live_start') {
          const { uname, title, room_id } = payload.data;
          addToast({
            type: 'live',
            title: '🔴 直播開播特報',
            message: `UP 主「${uname}」開播了！${title || ''}`,
            url: `https://live.bilibili.com/${room_id}`
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🔴 ${uname} 開播了！`, {
              body: title || '點擊進入直播間',
              icon: '/favicon.svg'
            });
          }
          loadInitialData();
        } else if (payload.type === 'new_video') {
          const { uname, title, bvid } = payload.data;
          addToast({
            type: 'video',
            title: '🎬 新影片發布',
            message: `UP 主「${uname}」發表新影片：${title}`,
            url: `https://www.bilibili.com/video/${bvid}`
          });
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`🎬 ${uname} 發布了新影片！`, {
              body: title,
              icon: '/favicon.svg'
            });
          }
        } else if (payload.type === 'new_dynamic') {
          const { uname } = payload.data;
          addToast({
            type: 'dynamic',
            title: '✨ 最新動態發布',
            message: `UP 主「${uname}」發布了新動態`
          });
        }
      } catch (e) {
        console.error('SSE 解析失敗:', e);
      }
    };

    return () => {
      es.close();
    };
  }, []);

  const activeLiveCount = liveList.filter((l) => l.live_status === 1).length;

  const handleSwitchTab = (view: ActiveView) => {
    triggerHaptic();
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="relative min-h-screen bg-[#05060a] bg-spatial-grid pb-28 text-slate-100 selection:bg-[#fb7299] selection:text-white overflow-hidden">
      {/* 全息深邃空間星海背景 (Spatial Atmosphere Background) */}
      <SpatialBackground />

      {/* 3D 浮動通知容器 */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* 頂部懸浮動態膠囊浮島 (Floating Island Navigation Pill) */}
      <div className="sticky top-3 sm:top-4 z-40 px-3 sm:px-6 w-full max-w-5xl mx-auto transition-[transform,backdrop-filter,box-shadow]">
        <header className="floating-island rounded-[2rem] px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(251,114,153,0.12)]">
          {/* Logo 與標題 */}
          <div className="flex items-center gap-3 logo-interactive cursor-pointer select-none" onClick={() => handleSwitchTab('feed')}>
            <div className="w-10 h-10 squircle-avatar bg-gradient-to-br from-[#00aeec] to-[#fb7299] p-[1.5px] shadow-[0_4px_16px_rgba(251,114,153,0.35)] flex-shrink-0">
              <div className="w-full h-full bg-[#0a0c16] squircle flex items-center justify-center">
                <Tv className="w-5 h-5 text-[#fb7299] drop-shadow-[0_0_8px_rgba(251,114,153,0.6)]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Bili特注
                </h1>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#fb7299]/15 text-[#fb7299] border border-[#fb7299]/30 tracking-widest uppercase">
                  SPATIAL 3D
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block tracking-tight">
                零登入 · WBI 算籤 · 雙層立體工藝
              </p>
            </div>
          </div>

          {/* 桌面端導航 Tabs (島式水銀滑動微膠囊) */}
          <nav className="hidden md:grid grid-cols-4 relative bg-black/50 p-1 rounded-full border border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)]">
            {/* 滑動背景發光膠囊 (Sliding Pill Indicator) */}
            <div 
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-b from-white/20 to-white/5 border border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.6),0_0_16px_rgba(251,114,153,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)] pointer-events-none transition-transform duration-300"
              style={{
                width: 'calc(25% - 2px)',
                transform: `translateX(${['feed', 'videos', 'live', 'settings'].indexOf(activeView) * 100}%)`,
                transitionTimingFunction: 'var(--ease-spring)'
              }}
            />
            {[
              { id: 'feed', label: '綜合動態', icon: Compass },
              { id: 'videos', label: '影片網格', icon: Film },
              { 
                id: 'live', 
                label: '直播看板', 
                icon: Radio, 
                badge: activeLiveCount > 0 ? activeLiveCount : undefined 
              },
              { id: 'settings', label: '特別關注管理', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchTab(tab.id as ActiveView)}
                  className={`btn-press focus-ring relative z-10 flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'text-[#fb7299] scale-110 drop-shadow-[0_0_6px_rgba(251,114,153,0.8)]' : ''}`} />
                  <span className="tracking-tight">{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="tabular-nums px-1.5 py-0.2 rounded-full bg-red-500 text-[10px] text-white font-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 右側操作：全量刷新與直播狀態指示 */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadInitialData}
              disabled={refreshing}
              className="btn-press btn-3d p-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/10 focus-ring shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              title="重新整理全站資料"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#fb7299]' : ''}`} />
            </button>

            <button
              onClick={() => handleSwitchTab('live')}
              className="btn-press focus-ring flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold transition-[transform,background-color,box-shadow] hover:bg-red-500/25 shadow-[0_0_16px_rgba(239,68,68,0.25)]"
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
              <span className="tabular-nums font-black">{activeLiveCount} 人開播</span>
            </button>
          </div>
        </header>
      </div>

      {/* 主內容區塊 */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-2 sm:pt-4">
        {/* 頂部空間科技 HUD 遙測狀態控制面板 */}
        <SpatialHUD
          ups={ups}
          liveList={liveList}
          refreshing={refreshing}
          onNavigateLive={() => handleSwitchTab('live')}
        />

        {/* 視圖流體切換舞台 (View Transition Stage，兩階段退場：舊視圖 exit 180ms 後再掛載新視圖) */}
        <div className={isExiting ? 'view-fade-exit' : 'view-fade-enter'}>
          <ErrorBoundary
            key={displayView}
            fallbackTitle={
              displayView === 'live'
                ? '直播看板渲染異常'
                : displayView === 'videos'
                ? '影片列表渲染異常'
                : displayView === 'feed'
                ? '動態看板渲染異常'
                : '設定頁面渲染異常'
            }
            onReset={loadInitialData}
          >
            {displayView === 'feed' && (
              <FeedView ups={ups} onRefresh={loadInitialData} />
            )}
            {displayView === 'videos' && (
              <VideosView ups={ups} />
            )}
            {displayView === 'live' && (
              <LiveView liveList={liveList} ups={ups} onRefresh={loadInitialData} />
            )}
            {displayView === 'settings' && (
              <SettingsView
                ups={ups}
                onRefreshUps={loadInitialData}
                onShowNotice={(msg) =>
                  addToast({ type: 'success', title: '操作提示', message: msg })
                }
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* 行動端懸浮玻璃膠囊底欄 (Floating Island Bottom Pill with Sliding Indicator) */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto">
        <div className="floating-island relative rounded-full p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_20px_rgba(251,114,153,0.15)] border border-white/15">
          {/* 行動端滑動發光膠囊底板 */}
          <div 
            className="absolute top-1.5 bottom-1.5 rounded-full bg-white/[0.08] border border-white/15 shadow-[0_2px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] pointer-events-none transition-transform duration-300"
            style={{
              width: 'calc(25% - 3px)',
              transform: `translateX(${['feed', 'videos', 'live', 'settings'].indexOf(activeView) * 100}%)`,
              transitionTimingFunction: 'var(--ease-spring)'
            }}
          />
          <div className="grid grid-cols-4 relative z-10">
            {[
              { id: 'feed', label: '動態', icon: Compass },
              { id: 'videos', label: '影片', icon: Film },
              { 
                id: 'live', 
                label: '直播', 
                icon: Radio, 
                badge: activeLiveCount > 0 ? activeLiveCount : undefined 
              },
              { id: 'settings', label: '管理', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSwitchTab(tab.id as ActiveView)}
                  className={`btn-press relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-[transform,color,background-color] ${
                    isActive
                      ? 'text-[#fb7299] font-black'
                      : 'text-slate-400 font-medium hover:text-slate-200'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'text-[#fb7299] scale-110 drop-shadow-[0_0_8px_rgba(251,114,153,0.7)]' : ''}`} />
                    {tab.badge !== undefined && (
                      <span className="tabular-nums absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white font-black flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] tracking-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
