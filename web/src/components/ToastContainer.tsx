import React, { useEffect, useRef, useState } from 'react';
import { Radio, Video, Sparkles, X, CheckCircle2, Info } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'live' | 'video' | 'dynamic' | 'info' | 'success';
  title: string;
  message: string;
  url?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

// Toast 自動停留 6 秒；移除前 200ms 先播放 toast-exit 滑出動畫，再真正移除 DOM
const TOAST_VISIBLE_MS = 6000;
const TOAST_EXIT_MS = 200;
const TOAST_EXIT_START_MS = TOAST_VISIBLE_MS - TOAST_EXIT_MS;

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast: t, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const timers = useRef<number[]>([]);
  const dismissedRef = useRef(false);

  // 手動關閉：立即開始退場動畫，200ms 後真正移除
  const dismissWithExit = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setIsExiting(true);
    timers.current.push(window.setTimeout(() => onDismiss(t.id), TOAST_EXIT_MS));
  };

  useEffect(() => {
    // 5.8s 時加上 toast-exit 開始滑出；6.0s 時移除（父層 App 亦有 6s 移除計時器作保底，皆為冪等操作）
    timers.current.push(
      window.setTimeout(() => setIsExiting(true), TOAST_EXIT_START_MS),
      window.setTimeout(() => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        onDismiss(t.id);
      }, TOAST_VISIBLE_MS)
    );
    return () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current = [];
    };
  }, [t.id, onDismiss]);

  const isLive = t.type === 'live';
  const isVideo = t.type === 'video';
  const isSuccess = t.type === 'success';

  return (
    <div
      className={`${isExiting ? 'toast-exit' : 'toast-enter'} pointer-events-auto relative overflow-hidden flex flex-col p-4 rounded-3xl border backdrop-blur-2xl transition-[transform,box-shadow,border-color] ${
        isLive
          ? 'bg-[#1a080d]/95 border-red-500/40 text-red-100 shadow-[0_16px_40px_-4px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : isVideo
          ? 'bg-[#061524]/95 border-[#00aeec]/40 text-sky-100 shadow-[0_16px_40px_-4px_rgba(0,174,236,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : isSuccess
          ? 'bg-[#061e16]/95 border-emerald-500/40 text-emerald-100 shadow-[0_16px_40px_-4px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]'
          : 'glass-panel-luxury text-slate-100 shadow-[0_16px_40px_-4px_rgba(2,6,23,0.8),inset_0_1px_0_rgba(255,255,255,0.2)]'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Squircle 圖示容器 */}
        <div
          className={`w-10 h-10 squircle flex items-center justify-center flex-shrink-0 shadow-inner ${
            isLive
              ? 'bg-red-500/20 text-red-400 border border-red-500/35 shadow-[0_0_14px_rgba(239,68,68,0.4)]'
              : isVideo
              ? 'bg-[#00aeec]/20 text-[#00aeec] border border-[#00aeec]/35 shadow-[0_0_14px_rgba(0,174,236,0.4)]'
              : isSuccess
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
              : 'bg-[#fb7299]/20 text-[#fb7299] border border-[#fb7299]/35 shadow-[0_0_14px_rgba(251,114,153,0.4)]'
          }`}
        >
          {isLive ? (
            <Radio className="w-5 h-5 animate-pulse" />
          ) : isVideo ? (
            <Video className="w-5 h-5" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : t.type === 'info' ? (
            <Info className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
        </div>

        {/* 文字與連結 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-300">
              {t.title}
            </h4>
            <button
              onClick={dismissWithExit}
              className="btn-press text-slate-400 hover:text-white p-1 squircle hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 mt-1 leading-snug tracking-tight text-pretty">
            {t.message}
          </p>
          {t.url && (
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className="btn-press inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#fb7299] hover:underline"
            >
              <span>前往查看</span>
              <span>&rarr;</span>
            </a>
          )}
        </div>
      </div>

      {/* 倒數進度條 (Progress Line: 6 秒平滑縮減至 0%) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 overflow-hidden">
        <div
          className={`toast-progress-bar h-full ${
            isLive
              ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
              : isVideo
              ? 'bg-[#00aeec] shadow-[0_0_8px_#00aeec]'
              : isSuccess
              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
              : 'bg-[#fb7299] shadow-[0_0_8px_#fb7299]'
          }`}
        />
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
