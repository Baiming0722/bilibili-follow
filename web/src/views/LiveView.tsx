import React, { useState } from 'react';
import { 
  Radio, 
  ExternalLink, 
  Users, 
  Clock, 
  RefreshCw, 
  Flame, 
  Tv, 
  Tag
} from 'lucide-react';
import { api } from '../api/client.js';
import type { LiveStatusInfo, UpUser } from '../types/index.js';
import { Card3D } from '../components/Card3D.js';

interface LiveViewProps {
  liveList: LiveStatusInfo[];
  ups: UpUser[];
  onRefresh: () => void;
}

export const LiveView: React.FC<LiveViewProps> = ({ liveList, ups, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      await api.refreshAll();
      onRefresh();
    } catch (err) {
      console.error('手動刷新直播失敗:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const safeLiveList = Array.isArray(liveList) ? liveList.filter(Boolean) : [];
  const safeUps = Array.isArray(ups) ? ups.filter(Boolean) : [];

  const activeLive = safeLiveList.filter((l) => l && l.live_status === 1);
  const offlineUps = safeUps.filter((up) => {
    if (!up || !up.mid) return false;
    const hasActiveLive = activeLive.some((l) => l && l.uid === up.mid);
    return !hasActiveLive;
  });

  // 計算開播時長 (多型態安全解析與邊界防禦)
  const getLiveDuration = (liveTime: string | number | undefined | null) => {
    try {
      if (!liveTime || liveTime === '0000-00-00 00:00:00') return '剛剛';
      let start = 0;
      if (typeof liveTime === 'number') {
        start = liveTime > 1e11 ? liveTime : liveTime * 1000;
      } else {
        const str = String(liveTime).trim();
        if (/^\d+$/.test(str)) {
          const num = Number(str);
          start = num > 1e11 ? num : num * 1000;
        } else {
          start = new Date(str.replace(/-/g, '/')).getTime();
        }
      }
      if (isNaN(start) || start <= 0) return '直播中';
      const diffMin = Math.max(1, Math.floor((Date.now() - start) / 60000));
      if (diffMin < 60) return `${diffMin} 分鐘`;
      const hours = Math.floor(diffMin / 60);
      const mins = diffMin % 60;
      return `${hours} 小時 ${mins} 分鐘`;
    } catch {
      return '直播中';
    }
  };

  return (
    <div className="space-y-8 animate-stagger-1">
      {/* 頂部標頭與手動刷新 (Double-Bezel 托盤結構) */}
      <div className="bezel-shell">
        <div className="bezel-core p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 squircle bg-gradient-to-br from-red-500/25 to-pink-500/10 text-red-400 flex items-center justify-center border border-red-500/30 shadow-[0_0_18px_rgba(239,68,68,0.25)]">
                <Radio className="w-5 h-5 animate-pulse text-red-400" />
              </div>
              <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-black/80 px-1.5 py-0.5 rounded-full border border-red-500/30">
                <div className="soundwave-bar" style={{ height: '8px' }} />
                <div className="soundwave-bar" style={{ height: '12px' }} />
                <div className="soundwave-bar" style={{ height: '6px' }} />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2.5 tracking-tight">
                即時全息直播看板
                <span className="jelly-badge-red text-red-300 text-xs px-2.5 py-0.5 squircle font-black tabular-nums shadow-[0_0_12px_rgba(239,68,68,0.4)]">
                  {activeLive.length} 人開播中
                </span>
              </h2>
              <p className="text-xs text-slate-400 tracking-tight">3D 空間音波等化監控 · 開播毫秒級推播</p>
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn-press btn-3d btn-3d-pink px-4 py-2.5 rounded-2xl text-white text-xs font-black flex items-center gap-2 shadow-[0_4px_16px_rgba(251,114,153,0.45)] focus-ring group"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span>{refreshing ? '全維巡檢中...' : '刷新開播狀態'}</span>
          </button>
        </div>
      </div>

      {/* 開播中 UP 主專區 (3D 霓虹全息舞台) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <Flame className="w-5 h-5 text-red-500 fill-red-500/40" />
            <h3 className="text-lg font-black text-white tracking-tight">全息直播舞台</h3>
          </div>
          {activeLive.length > 0 && (
            <div className="flex items-center gap-1 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider">ON AIR LIVE</span>
            </div>
          )}
        </div>

        {refreshing && activeLive.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bezel-shell">
                <div className="bezel-core p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 squircle shimmer-skeleton flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="w-32 h-4 shimmer-skeleton rounded-md" />
                      <div className="w-24 h-3 shimmer-skeleton rounded-md" />
                    </div>
                  </div>
                  <div className="w-full aspect-video shimmer-skeleton rounded-2xl" />
                  <div className="w-full h-12 shimmer-skeleton rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : activeLive.length === 0 ? (
          <div className="bezel-shell">
            <div className="bezel-core p-16 text-center text-slate-400 space-y-4 border-dashed border-white/10">
              <div className="w-16 h-16 squircle bg-gradient-to-tr from-red-500/20 to-[#fb7299]/20 flex items-center justify-center mx-auto border border-white/10 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
                <Tv className="w-8 h-8 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-100 tracking-tight">目前關注的 UP 主均在休憩中</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  後端引擎正持續定時檢測直播間，一旦有人開播將透過全息聲光與系統彈窗通知您。
                </p>
              </div>
              <button
                onClick={handleManualRefresh}
                className="btn-press btn-3d btn-3d-dark px-6 py-2.5 rounded-2xl text-xs font-bold text-slate-200 inline-flex items-center gap-2 border border-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>立即重新探測開播狀態</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 perspective-container content-reveal">
            {activeLive.map((live, idx) => (
              <Card3D
                key={live.uid}
                intensity={14}
                glowColor="rgba(239, 68, 68, 0.22)"
                containerClassName={`animate-stagger-${Math.min(idx + 1, 5)} flex flex-col`}
                className="bezel-shell-stage flex flex-col h-full group"
              >
                <div className="bezel-core-stage p-5 sm:p-6 flex flex-col flex-1 relative overflow-hidden preserve-3d">
                  {/* 全息雷射微掃描線 */}
                  <div className="pointer-events-none absolute inset-0 hud-scanlines opacity-15" />

                  {/* 科技角標飾線 (Cyberpunk HUD Brackets) */}
                  <div className="pointer-events-none absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-red-500/70 rounded-tl-sm" />
                  <div className="pointer-events-none absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-red-500/70 rounded-tr-sm" />
                  <div className="pointer-events-none absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-red-500/70 rounded-bl-sm" />
                  <div className="pointer-events-none absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-red-500/70 rounded-br-sm" />

                  {/* 背景全息流光球 */}
                  <div className="absolute -top-16 -right-16 w-52 h-52 bg-red-500/20 rounded-full blur-3xl pointer-events-none group-hover:bg-red-500/35 transition-[transform,opacity] duration-700" />

                  {/* 頂部 UP 主資訊與 8 根跳動霓虹音波柱 (translate-z-40) */}
                  <div className="flex items-start justify-between gap-3 mb-4 relative z-10 translate-z-40">
                    <div className="flex items-center gap-3.5">
                      <div className="relative flex-shrink-0">
                        <img
                          src={live.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'}
                          alt={live.uname}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 squircle-avatar object-cover border-2 border-red-500/80 shadow-[0_0_22px_rgba(239,68,68,0.55)] group-hover:scale-105 transition-transform"
                        />
                        {/* 雙層/多層水面漣漪絲滑擴散光環 */}
                        <div className="absolute -top-1 -right-1 live-pulse-lamp w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-[0_0_12px_#ef4444]">
                          <span className="absolute inset-0 rounded-full bg-red-500 live-ripple-1 pointer-events-none" />
                          <span className="absolute inset-0 rounded-full bg-red-500 live-ripple-2 pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base text-white group-hover:text-[#fb7299] transition-colors tracking-tight drop-shadow">
                            {live.uname || `UID: ${live.uid}`}
                          </h4>
                          {/* 動態音波等化器 (8 根不同頻率跳動的霓虹光譜柱) */}
                          <div className="flex items-end gap-1 h-5 px-2 py-0.5 rounded-md bg-black/70 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                            <div className="soundwave-bar" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="jelly-badge text-[11px] px-2.5 py-0.5 squircle text-slate-300 flex items-center gap-1 font-semibold shadow">
                            <Tag className="w-3 h-3 text-[#00aeec]" />
                            {live.area_name || '綜合直播'}
                          </span>
                          <span className="jelly-badge-red text-[11px] px-2.5 py-0.5 squircle text-red-200 flex items-center gap-1 font-bold tabular-nums shadow">
                            <Clock className="w-3 h-3 text-red-400" /> 已播 {getLiveDuration(live.live_time)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="jelly-badge-red text-red-200 text-xs px-3 py-1 squircle font-black flex items-center gap-1.5 tabular-nums flex-shrink-0 shadow-[0_0_16px_rgba(239,68,68,0.45)]">
                      <Users className="w-3.5 h-3.5 text-red-400" />
                      {(Number(live.online) || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* 直播即時封面或截圖 (translate-z-25 帶鏡面微光掠過效果) */}
                  {(live.cover_from_user || live.keyframe) && (
                    <div className="sheen-wrapper relative rounded-2xl overflow-hidden aspect-video mb-4 border border-white/15 bg-black/60 shadow-[0_12px_30px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.2)] translate-z-20">
                      <img
                        src={live.keyframe || live.cover_from_user}
                        alt={live.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
                      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/85 backdrop-blur-md px-3 py-1 squircle text-xs text-white font-bold border border-white/20 shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                        <span>即時抓拍訊號</span>
                      </div>
                    </div>
                  )}

                  {/* 直播間標題 (translate-z-30) */}
                  <p className="text-sm font-bold text-slate-100 mb-5 line-clamp-2 leading-relaxed bg-white/[0.04] p-3.5 rounded-2xl border border-white/10 text-pretty shadow-inner translate-z-30">
                    {live.title || '正在直播精彩內容中...'}
                  </p>

                  {/* 進入直播間按鈕 (translate-z-50 懸浮磁吸 Button-in-Button) */}
                  <a
                    href={`https://live.bilibili.com/${live.room_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-press btn-3d btn-3d-pink w-full py-2.5 px-4 rounded-full text-center text-sm font-black text-white flex items-center justify-between shadow-[0_8px_25px_rgba(251,114,153,0.6)] mt-auto group/btn focus-ring translate-z-50"
                  >
                    <span className="tracking-tight ml-2">進入 B 站直播間觀看</span>
                    {/* 內嵌獨立圓形圖示微徽章 (Button-in-Button) */}
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shadow-inner group-hover/btn:translate-x-1 group-hover/btn:-translate-y-0.5 group-hover/btn:scale-105 transition-transform">
                      <ExternalLink className="w-4 h-4 text-white" />
                    </div>
                  </a>
                </div>
              </Card3D>
            ))}
          </div>
        )}
      </section>

      {/* 待機與未開播 UP 主列表 (立體雙層晶片陣列) */}
      <section className="space-y-4">
        <h3 className="text-base font-bold text-slate-300 flex items-center gap-2 tracking-tight">
          <span>待機與離線 UP 主</span>
          <span className="text-xs text-slate-400 bg-white/[0.06] px-2.5 py-0.5 squircle tabular-nums font-semibold border border-white/5">
            {offlineUps.length} 位
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {offlineUps.map((up) => {
            const faceUrl = up.face ? (up.face.startsWith('//') ? `https:${up.face}` : up.face) : 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
            const upName = up.name || `UP主 (${up.mid})`;
            return (
              <div
                key={up.mid}
                className="p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 transition-[transform,box-shadow,border-color] group"
              >
                <div className="p-3 rounded-[14px] bg-[#0b0e1a]/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={faceUrl}
                      alt={upName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = '1';
                          target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                        }
                      }}
                      className="w-10 h-10 squircle-avatar object-cover grayscale opacity-60 ring-1 ring-white/10 group-hover:grayscale-0 group-hover:opacity-100 transition-[filter,opacity,transform]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate tracking-tight group-hover:text-white transition-colors">{upName}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {up.liveRoom?.title ? `上次: ${up.liveRoom.title}` : '離線休息中'}
                      </p>
                    </div>
                  </div>

                  {up.liveRoom?.roomid ? (
                    <a
                      href={`https://live.bilibili.com/${up.liveRoom.roomid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-press p-2 rounded-xl bg-white/[0.05] hover:bg-[#fb7299]/20 text-slate-400 hover:text-[#fb7299] flex-shrink-0 transition-colors border border-white/5"
                      title="造訪直播間"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
