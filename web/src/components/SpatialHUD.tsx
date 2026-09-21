import React from 'react';
import { Radio, ShieldCheck, Activity, Users, Cpu } from 'lucide-react';
import type { UpUser, LiveStatusInfo } from '../types/index.js';

interface SpatialHUDProps {
  ups: UpUser[];
  liveList: LiveStatusInfo[];
  refreshing: boolean;
  onNavigateLive: () => void;
}

export const SpatialHUD: React.FC<SpatialHUDProps> = ({
  ups,
  liveList,
  refreshing,
  onNavigateLive
}) => {
  const activeLiveCount = liveList.filter((l) => l.live_status === 1).length;

  return (
    <div className="w-full my-4">
      {/* 3D 空間科技 HUD 遙測狀態控制面板 (Spatial HUD Telemetry Bar) */}
      <div className="hud-glass-panel relative rounded-2xl p-3 sm:p-4 border border-white/10 bg-gradient-to-r from-[#0d1224]/85 via-[#080b16]/90 to-[#120e20]/85 backdrop-blur-2xl shadow-[0_20px_45px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] overflow-hidden">
        {/* 全息雷射微掃描線 */}
        <div className="pointer-events-none absolute inset-0 hud-scanlines opacity-20" />

        {/* 科技角標飾線 (Cyberpunk HUD Brackets) */}
        <div className="pointer-events-none absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#00aeec]/60 rounded-tl-sm" />
        <div className="pointer-events-none absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#fb7299]/60 rounded-tr-sm" />
        <div className="pointer-events-none absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#00aeec]/60 rounded-bl-sm" />
        <div className="pointer-events-none absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#fb7299]/60 rounded-br-sm" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs font-mono">
          {/* 左側：雷達動態掃描環 + 系統引擎狀態 */}
          <div className="flex items-center gap-3">
            {/* 3D 全息立體雷達 (Orbital Live Radar) */}
            <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-black/60 border border-[#00aeec]/40 shadow-[0_0_15px_rgba(0,174,236,0.3)]">
              {/* 同心圓微縮波紋 */}
              <div className="absolute inset-1 rounded-full border border-[#00aeec]/20" />
              <div className="absolute inset-2 rounded-full border border-dashed border-[#00aeec]/30" />
              {/* 雷達掃描光束 */}
              <div className="absolute inset-0 rounded-full radar-sweep-beam" />
              {/* 中心核心 LED */}
              <div className={`w-2 h-2 rounded-full ${activeLiveCount > 0 ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-[#00aeec] shadow-[0_0_8px_#00aeec]'} animate-pulse`} />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">[SYS-CORE]</span>
                <span className="font-bold flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  DUAL-ENGINE ACTIVE
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2">
                <span>MODE: STANDALONE/OFFLINE-READY</span>
                <span className="text-slate-600">|</span>
                <span className="text-sky-400 flex items-center gap-0.5">
                  <Cpu className="w-3 h-3" /> WBI v2 CIPHER READY
                </span>
              </div>
            </div>
          </div>

          {/* 中間與右側：即時空間數據儀表 */}
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* 追蹤目標總數 */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 shadow-inner">
              <Users className="w-3.5 h-3.5 text-[#00aeec]" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-bold tracking-tight">TARGETS</span>
                <span className="text-xs font-black text-white tabular-nums tracking-wide">
                  {ups.length.toString().padStart(2, '0')} <span className="text-[9px] text-slate-500 font-normal">UPS</span>
                </span>
              </div>
            </div>

            {/* 開播雷達 (可點擊跳轉) */}
            <button
              onClick={onNavigateLive}
              className={`btn-press flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-[transform,color,background-color] shadow-inner ${
                activeLiveCount > 0
                  ? 'bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:bg-red-500/25'
                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <Radio className={`w-3.5 h-3.5 ${activeLiveCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                {activeLiveCount > 0 && (
                  <span className="absolute -inset-1 rounded-full bg-red-500/30 animate-ping pointer-events-none" />
                )}
              </div>
              <div className="flex flex-col leading-none text-left">
                <span className="text-[9px] font-bold tracking-tight">ON-AIR RADAR</span>
                <span className="text-xs font-black tabular-nums tracking-wide flex items-center gap-1.5">
                  {activeLiveCount > 0 ? (
                    <>
                      <span className="text-red-400 font-extrabold">{activeLiveCount} LIVE</span>
                      {/* GPU 渲染流暢自適應 3 柱音頻心跳波形 */}
                      <span className="flex items-end gap-1 h-3 px-1 py-0.5 rounded bg-red-500/20">
                        <span 
                          className="w-1 rounded-full bg-red-400 animate-pulse origin-bottom"
                          style={{
                            height: `${Math.min(10, 4 + activeLiveCount * 2)}px`,
                            animationDuration: '600ms'
                          }}
                        />
                        <span 
                          className="w-1 rounded-full bg-red-400 animate-pulse origin-bottom"
                          style={{
                            height: `${Math.min(12, 6 + activeLiveCount * 3)}px`,
                            animationDuration: '400ms',
                            animationDelay: '150ms'
                          }}
                        />
                        <span 
                          className="w-1 rounded-full bg-red-400 animate-pulse origin-bottom"
                          style={{
                            height: `${Math.min(8, 3 + activeLiveCount * 2)}px`,
                            animationDuration: '800ms',
                            animationDelay: '300ms'
                          }}
                        />
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">STANDBY (0)</span>
                  )}
                </span>
              </div>
            </button>

            {/* 引擎安全校驗 */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 shadow-inner">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-slate-400 font-bold tracking-tight">ANTI-CORS</span>
                <span className="text-xs font-black text-emerald-300 tracking-wide">ZERO-LOGIN PASS</span>
              </div>
            </div>

            {/* 刷新遙測指示 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400">
              <Activity className={`w-3 h-3 ${refreshing ? 'animate-spin text-[#fb7299]' : 'text-slate-500'}`} />
              <span className="text-[10px] hidden sm:inline">{refreshing ? 'TELEMETRY SYNCING...' : 'LIVE SYNCED'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
