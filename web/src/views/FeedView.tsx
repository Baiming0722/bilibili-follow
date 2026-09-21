import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Sparkles, 
  ExternalLink, 
  CheckCheck, 
  Search, 
  Image as ImageIcon, 
  Film, 
  FileText, 
  Repeat, 
  Radio,
  MessageSquare,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X, 
  Clock,
  Tv,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client.js';
import type { DynamicItem, UpUser, CommentItem } from '../types/index.js';
import { Card3D } from '../components/Card3D.js';

interface FeedViewProps {
  ups: UpUser[];
  onRefresh?: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({ ups }) => {
  const [items, setItems] = useState<DynamicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);

  // 篩選器
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedMid, setSelectedMid] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 圖片預覽彈窗 Lightbox
  interface LightboxState {
    images: string[];
    currentIndex: number;
  }
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  // Lightbox 兩階段關閉：先播放 200ms 退場動畫，再真正卸載 DOM
  const [isLightboxClosing, setIsLightboxClosing] = useState(false);
  const [isImgLoading, setIsImgLoading] = useState(true);
  const [imgLoadError, setImgLoadError] = useState(false);
  const lightboxCloseTimer = useRef<number | null>(null);

  // 清理 URL 並轉成高清原圖連結
  const getHighResImageUrl = (url: string) => {
    let clean = url.trim();
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    } else if (clean.startsWith('http://')) {
      clean = clean.replace(/^http:\/\//, 'https://');
    }
    // 若為 B 站圖片並帶有常見裁剪/縮圖後綴 (例如 @518w_... 或 @...webp)，在大圖預覽時移除後綴以顯示原畫質大圖
    if (clean.includes('hdslb.com') && clean.includes('@')) {
      clean = clean.replace(/@[^/]+$/, '');
    }
    return clean;
  };

  const openLightbox = (images: string[] | string, initialIndex = 0) => {
    const list = Array.isArray(images) ? images : [images];
    if (list.length === 0) return;
    if (lightboxCloseTimer.current !== null) {
      clearTimeout(lightboxCloseTimer.current);
      lightboxCloseTimer.current = null;
    }
    setIsLightboxClosing(false);
    setIsImgLoading(true);
    setImgLoadError(false);
    setLightbox({
      images: list.map(getHighResImageUrl),
      currentIndex: Math.max(0, Math.min(initialIndex, list.length - 1))
    });
  };

  const closeLightbox = () => {
    if (!lightbox || isLightboxClosing) return;
    setIsLightboxClosing(true);
    lightboxCloseTimer.current = window.setTimeout(() => {
      setLightbox(null);
      setIsLightboxClosing(false);
      lightboxCloseTimer.current = null;
    }, 200);
  };

  const prevLightboxImage = () => {
    if (!lightbox || lightbox.images.length <= 1) return;
    setIsImgLoading(true);
    setImgLoadError(false);
    setLightbox((prev) =>
      prev
        ? {
            ...prev,
            currentIndex: (prev.currentIndex - 1 + prev.images.length) % prev.images.length
          }
        : null
    );
  };

  const nextLightboxImage = () => {
    if (!lightbox || lightbox.images.length <= 1) return;
    setIsImgLoading(true);
    setImgLoadError(false);
    setLightbox((prev) =>
      prev
        ? {
            ...prev,
            currentIndex: (prev.currentIndex + 1) % prev.images.length
          }
        : null
    );
  };

  // 鍵盤導覽 (Esc 關閉, 左右方向鍵切換多張圖片)
  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        prevLightboxImage();
      } else if (e.key === 'ArrowRight') {
        nextLightboxImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox, isLightboxClosing]);

  // 卸載時清理關閉計時器，避免記憶體洩漏
  useEffect(() => {
    return () => {
      if (lightboxCloseTimer.current !== null) {
        clearTimeout(lightboxCloseTimer.current);
      }
    };
  }, []);

  // 評論區狀態管理 (以 dynamic id_str 為 key)
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [commentsState, setCommentsState] = useState<
    Record<
      string,
      {
        list: CommentItem[];
        total: number;
        page: number;
        hasMore: boolean;
        loading: boolean;
        error?: string;
      }
    >
  >({});

  const toggleComments = (item: DynamicItem) => {
    const id = item.id_str;
    if (expandedCommentId === id) {
      setExpandedCommentId(null);
      return;
    }
    setExpandedCommentId(id);
    if (!commentsState[id]) {
      loadComments(item, 1);
    }
  };

  const loadComments = async (item: DynamicItem, page = 1) => {
    const id = item.id_str;
    // 防禦性守衛：無有效 commentId（空值或影片降級產生的 video_BV 假 id）
    // 直接降級提示，不發出必定 -400 的無效請求
    const cOid = (item.commentId || '').trim();
    if (!cOid || cOid.startsWith('video_')) {
      setCommentsState((prev) => ({
        ...prev,
        [id]: {
          list: [],
          total: 0,
          page,
          hasMore: false,
          loading: false,
          error: '該動態暫不支援站內評論查看，可至 B 站原文參與討論'
        }
      }));
      return;
    }
    const cType = item.commentType ?? (item.type === 'video' ? 1 : 11);

    setCommentsState((prev) => ({
      ...prev,
      [id]: {
        list: prev[id]?.list || [],
        total: prev[id]?.total || 0,
        page,
        hasMore: prev[id]?.hasMore ?? true,
        loading: true,
        error: undefined
      }
    }));

    try {
      const res = await api.getComments(cType, cOid, page, 20);
      // 後端以 error 欄位攜帶 B 站非 0 回應原因：空列表 + 有 error 即為失敗，需顯示原因而非「暫無評論」
      const emptyError = res.list.length === 0 ? res.error : undefined;
      setCommentsState((prev) => ({
        ...prev,
        [id]: {
          list: page === 1 ? res.list : [...(prev[id]?.list || []), ...res.list],
          total: res.total,
          page,
          hasMore: res.hasMore,
          loading: false,
          error: emptyError
        }
      }));
    } catch (err: any) {
      setCommentsState((prev) => ({
        ...prev,
        [id]: {
          list: prev[id]?.list || [],
          total: prev[id]?.total || 0,
          page,
          hasMore: false,
          loading: false,
          error: err.message || '載入評論失敗'
        }
      }));
    }
  };

  // 已讀管理 (儲存於 localStorage)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('bili_read_dynamics');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markAsRead = (id_str: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id_str);
      localStorage.setItem('bili_read_dynamics', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const markAllAsRead = () => {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id_str));
      localStorage.setItem('bili_read_dynamics', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // 獲取動態資料
  const fetchFeed = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = await api.getFeed({
        type: selectedType === 'all' ? undefined : selectedType,
        mid: selectedMid || undefined,
        keyword: searchKeyword.trim() || undefined,
        cursor: reset ? undefined : cursor || undefined,
        limit: 20
      });

      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err) {
      console.error('獲取動態失敗:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeed(true);
  }, [selectedType, selectedMid]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFeed(true);
  };

  // 時間格式化 (相對時間)
  const formatTime = (timestamp: number | undefined | null) => {
    if (!timestamp || isNaN(Number(timestamp))) return '剛剛';
    try {
      // 若為毫秒時間戳 (長度大於 10 位) 轉為秒計算
      const timeSec = Number(timestamp) > 1e11 ? Math.floor(Number(timestamp) / 1000) : Number(timestamp);
      const diff = Math.floor(Date.now() / 1000) - timeSec;
      if (diff < 60) return '剛剛';
      if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
      if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
      return new Date(timeSec * 1000).toLocaleDateString('zh-TW');
    } catch {
      return '剛剛';
    }
  };

  const safeUps = Array.isArray(ups) ? ups.filter(Boolean) : [];

  // 取得 UP 主頭像 (含協議修復、關注清單回退與預設頭像)
  const getAuthorAvatar = (item: DynamicItem) => {
    const up = safeUps.find((u) => u.mid === item.mid);
    let face = item.authorFace || up?.face || '';
    if (!face) {
      return 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
    }
    if (face.startsWith('//')) {
      face = `https:${face}`;
    }
    return face;
  };

  const typeTabs = [
    { id: 'all', label: '全部動態', icon: Sparkles },
    { id: 'live', label: '直播', icon: Radio },
    { id: 'video', label: '影片', icon: Film },
    { id: 'draw', label: '圖文/相簿', icon: ImageIcon },
    { id: 'article', label: '專欄', icon: FileText },
    { id: 'forward', label: '轉發', icon: Repeat }
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-stagger-1 pb-16">
      {/* 頂部控制面板：類型 Tabs + UP 主篩選 + 搜尋 (Double-Bezel 托盤結構) */}
      <div className="bezel-shell">
        <div className="bezel-core p-4 sm:p-5 space-y-4">
          {/* 橫向可滑動 Tab */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-1.5 flex-nowrap">
              {typeTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = selectedType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedType(tab.id)}
                    className={`btn-press focus-ring flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-[color,background-color,box-shadow] duration-300 ${
                      isActive
                        ? 'btn-3d btn-3d-pink text-white shadow-[0_4px_16px_rgba(251,114,153,0.45)]'
                        : 'bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="tracking-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={markAllAsRead}
              className="btn-press focus-ring flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-bold text-slate-300 hover:text-white whitespace-nowrap border border-white/10 transition-[color,background-color] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
              title="全部標記為已讀"
            >
              <CheckCheck className="w-4 h-4 text-[#fb7299]" />
              <span className="hidden sm:inline tracking-tight">全部已讀</span>
            </button>
          </div>

          {/* 篩選欄：UP 主選擇與關鍵字搜尋 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
            {/* UP 主橫向快捷頭像條 */}
            <div className="min-w-0 flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
              <button
                onClick={() => setSelectedMid(null)}
                className={`btn-press focus-ring px-3.5 py-1.5 rounded-full text-xs font-black transition-[color,background-color,box-shadow] whitespace-nowrap flex-shrink-0 ${
                  selectedMid === null
                    ? 'bg-white text-slate-900 shadow-[0_4px_14px_rgba(255,255,255,0.3)]'
                    : 'bg-white/[0.05] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                全部
              </button>
              {safeUps.map((up) => {
                const faceUrl = up.face ? (up.face.startsWith('//') ? `https:${up.face}` : up.face) : 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                const isSelected = selectedMid === up.mid;
                return (
                  <button
                    key={up.mid}
                    onClick={() => setSelectedMid(isSelected ? null : up.mid)}
                    className={`btn-press focus-ring flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-bold transition-[color,background-color,box-shadow] duration-300 whitespace-nowrap flex-shrink-0 border ${
                      isSelected
                        ? 'bg-[#fb7299] text-white border-[#fb7299] jelly-ring-active'
                        : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] border-white/[0.06]'
                    }`}
                  >
                    <img
                      src={faceUrl}
                      alt={up.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.fallback) {
                          target.dataset.fallback = '1';
                          target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                        }
                      }}
                      className={`w-5 h-5 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0 transition-transform duration-300 ${isSelected ? 'scale-110' : ''}`}
                    />
                    <span className="truncate max-w-[84px] tracking-tight">{up.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 搜尋表單 */}
            <form onSubmit={handleSearchSubmit} className="relative sm:w-60 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋動態關鍵字..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="focus-ring w-full pl-9 pr-8 py-1.5 bg-white/[0.04] rounded-full text-xs text-white placeholder:text-slate-500 focus:outline-none border border-white/[0.08] transition-[border-color,box-shadow,background-color] shadow-inner"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    fetchFeed(true);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* 動態內容流 */}
      {loading ? (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bezel-shell">
              <div className="bezel-core p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 squircle shimmer-skeleton flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="w-32 h-4 shimmer-skeleton rounded-md" />
                    <div className="w-20 h-3 shimmer-skeleton rounded-md" />
                  </div>
                </div>
                <div className="space-y-2 py-2">
                  <div className="w-full h-4 shimmer-skeleton rounded-md" />
                  <div className="w-4/5 h-4 shimmer-skeleton rounded-md" />
                  <div className="w-2/3 h-4 shimmer-skeleton rounded-md" />
                </div>
                <div className="w-full h-48 shimmer-skeleton rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="bezel-shell">
          <div className="bezel-core p-16 text-center text-slate-400 space-y-4 border-dashed border-white/10">
            <div className="w-16 h-16 squircle bg-gradient-to-tr from-[#00aeec]/20 to-[#fb7299]/20 flex items-center justify-center mx-auto border border-white/10 shadow-[0_0_25px_rgba(0,174,236,0.2)]">
              <Sparkles className="w-8 h-8 text-[#00aeec]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-100 tracking-tight">暫無符合條件的動態</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                當前篩選條件下無新動態。請嘗試重置關鍵字或切換 UP 主標籤。
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedMid(null);
                setSearchKeyword('');
              }}
              className="btn-press btn-3d btn-3d-pink px-6 py-2.5 rounded-full text-xs font-black text-white inline-flex items-center gap-2 shadow-[0_4px_16px_rgba(251,114,153,0.45)]"
            >
              <span>重置全部篩選</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 content-reveal">
          {items.map((item, idx) => {
            const isRead = readIds.has(item.id_str);
            const dynamicUrl = `https://t.bilibili.com/${item.id_str}`;
            const upInfo = ups.find((u) => u.mid === item.mid);

            return (
              <Card3D
                key={item.id_str}
                intensity={7}
                preserve3d={true}
                glowColor="rgba(251, 114, 153, 0.12)"
                onClick={() => markAsRead(item.id_str)}
                containerClassName={`animate-stagger-${Math.min(idx + 1, 5)} card-read-recede card-content-visibility ${
                  isRead ? 'is-read hover:opacity-100' : ''
                }`}
                className="bezel-shell cursor-pointer group"
              >
                <div className="bezel-core p-4 sm:p-5 relative preserve-3d">
                  {/* 未讀高光邊界裝飾 */}
                  {!isRead && (
                    <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-[#fb7299] to-transparent shadow-[0_0_12px_#fb7299]" />
                  )}

                  {/* 科技角標飾線 (Cyberpunk HUD Brackets) */}
                  <div className="pointer-events-none absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t border-l border-[#fb7299]/40 rounded-tl-sm z-30" />
                  <div className="pointer-events-none absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t border-r border-[#fb7299]/40 rounded-tr-sm z-30" />

                  {/* UP 主資訊欄 */}
                  <div className="flex items-center justify-between mb-3 translate-z-30">
                    <div className="flex items-center gap-3 min-w-0">
                      <a
                        href={`https://space.bilibili.com/${item.mid}`}
                        target="_blank"
                        rel="noreferrer"
                        className="relative group/avatar flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img
                          src={getAuthorAvatar(item)}
                          alt={item.authorName || upInfo?.name || 'UP 主頭像'}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.fallback) {
                              target.dataset.fallback = '1';
                              target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                            }
                          }}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-white/10 ring-2 ring-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.6)] group-hover/avatar:scale-105 transition-transform"
                        />
                      </a>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://space.bilibili.com/${item.mid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-sm sm:text-base text-white hover:text-[#fb7299] transition-colors tracking-tight truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.authorName || upInfo?.name || `UP 主 (${item.mid})`}
                          </a>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#fb7299] animate-pulse shadow-[0_0_8px_#fb7299] flex-shrink-0" title="未讀動態" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span>{formatTime(item.pubTime)}</span>
                          <span>·</span>
                          {item.pubAction ? (
                            <span className="font-bold text-[#fb7299] px-2 py-0.5 rounded-full bg-[#fb7299]/15 border border-[#fb7299]/30 text-[10px] shadow-sm flex items-center gap-1">
                              {item.type === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-[#fb7299] animate-ping" />}
                              {item.pubAction}
                            </span>
                          ) : (
                            <span className="capitalize font-bold text-slate-300 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] shadow-sm">
                              {item.type === 'video' ? '影片' : item.type === 'live' ? '直播' : item.type === 'draw' ? '圖文' : item.type === 'article' ? '專欄' : item.type === 'forward' ? '轉發' : '動態'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(item.id_str);
                        }}
                        className={`btn-press p-2 rounded-full transition-[color,opacity] ${
                          isRead
                            ? 'text-slate-500 hover:text-slate-300'
                            : 'text-[#fb7299] hover:bg-[#fb7299]/15 border border-[#fb7299]/20'
                        }`}
                        title={isRead ? '已讀' : '標記為已讀'}
                      >
                        <CheckCheck className="w-4 h-4" />
                      </button>
                      <a
                        href={dynamicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-press p-2 rounded-full bg-white/[0.05] hover:bg-[#fb7299]/25 text-slate-400 hover:text-white border border-white/10 transition-colors"
                        title="在 Bilibili 開啟原文"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {/* 動態文字內容 */}
                  {item.text && (
                    <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line mb-3 select-text font-normal text-pretty translate-z-20">
                      {item.text}
                    </p>
                  )}

                  {/* 標題 (影片或文章) */}
                  {item.title && (
                    <h4 className="text-base sm:text-lg font-bold text-white mb-3 line-clamp-2 tracking-tight text-balance translate-z-20">
                      {item.title}
                    </h4>
                  )}

                  {/* 直播卡片 (1:1 對標 B 站原生橫向直播卡片) */}
                  {(item.type === 'live' || item.liveInfo) && (
                    <a
                      href={item.liveInfo?.link || (item.liveInfo?.room_id ? `https://live.bilibili.com/${item.liveInfo.room_id}` : dynamicUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="sheen-wrapper block relative rounded-2xl overflow-hidden group/live border border-white/15 my-3 bg-gradient-to-r from-slate-900/90 to-slate-950/90 shadow-[0_12px_32px_rgba(0,0,0,0.85)] hover:border-[#fb7299]/50 transition-[transform,box-shadow,border-color] duration-300 preserve-3d"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col sm:flex-row items-stretch">
                        {/* 左側：直播即時封面 (16:9 比例) */}
                        <div className="sm:w-[42%] aspect-video relative overflow-hidden bg-slate-950 flex-shrink-0 translate-z-20">
                          <img
                            src={item.liveInfo?.cover || item.cover || 'https://i0.hdslb.com/bfs/live/default_cover.jpg'}
                            alt={item.liveInfo?.title || item.title || '直播封面'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover/live:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          />
                          {/* 左上角：🔴 直播中 呼吸燈徽章 */}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fb7299] text-white text-[11px] font-black shadow-[0_2px_10px_rgba(251,114,153,0.8)] backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span>直播中</span>
                          </div>
                        </div>

                        {/* 右側：直播詳細資訊 */}
                        <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-0 translate-z-30">
                          <div className="space-y-2">
                            <h4 className="text-sm sm:text-base font-bold text-white group-hover/live:text-[#fb7299] transition-colors line-clamp-2 tracking-tight leading-snug">
                              {item.liveInfo?.title || item.title || '正在直播中'}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              {item.liveInfo?.area_name && (
                                <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-slate-300 font-semibold border border-white/10 text-[11px]">
                                  {item.liveInfo.area_name}
                                </span>
                              )}
                              {item.liveInfo?.watched_show && (
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <span>·</span>
                                  <span>{item.liveInfo.watched_show}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                            <span className="text-xs font-bold text-[#fb7299] flex items-center gap-1.5">
                              <Tv className="w-3.5 h-3.5" />
                              <span>進入直播間觀看</span>
                            </span>
                            <div className="w-7 h-7 rounded-full bg-white/[0.08] group-hover/live:bg-[#fb7299] flex items-center justify-center transition-colors">
                              <ExternalLink className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  )}

                  {/* 影片展示卡片 (標準 16:9 比例) */}
                  {item.type === 'video' && item.cover && (
                    <a
                      href={item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : dynamicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="sheen-wrapper block relative rounded-2xl overflow-hidden group/vid border border-white/15 my-3 bg-slate-950/80 shadow-[0_12px_32px_rgba(0,0,0,0.85)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full aspect-video relative overflow-hidden bg-slate-900">
                        <img
                          src={item.cover.startsWith('//') ? `https:${item.cover}` : item.cover}
                          alt={item.title || '影片封面'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex items-end p-3.5 sm:p-4">
                          <div className="flex items-center justify-between w-full text-white">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#fb7299] flex items-center justify-center shadow-[0_4px_20px_rgba(251,114,153,0.6)] group-hover/vid:scale-110 transition-transform">
                                <Film className="w-5 h-5 fill-white text-white" />
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-300 tabular-nums">
                                  {item.bvid || 'Bilibili 影片'}
                                </p>
                                <p className="text-xs sm:text-sm font-bold line-clamp-1 tracking-tight">點擊立即觀看</p>
                              </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover/vid:scale-110 transition-transform">
                              <ExternalLink className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  )}

                  {/* 九宮格圖片相簿 */}
                  {item.images && item.images.length > 0 && (
                    <div
                      className={`grid gap-2 sm:gap-2.5 my-3 translate-z-20 ${
                        item.images.length === 1
                          ? 'grid-cols-1 max-w-sm sm:max-w-md'
                          : item.images.length === 2 || item.images.length === 4
                          ? 'grid-cols-2 max-w-md sm:max-w-lg'
                          : 'grid-cols-3'
                      }`}
                    >
                      {item.images.map((imgUrl, i) => {
                        const safeUrl = imgUrl.startsWith('//') ? `https:${imgUrl}` : imgUrl;
                        return (
                          <div
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLightbox(item.images!, i);
                            }}
                            className="sheen-wrapper relative rounded-xl overflow-hidden aspect-square border border-white/10 cursor-zoom-in group/img bg-slate-900/60 shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:scale-[1.02] transition-transform duration-300"
                          >
                            <img
                              src={safeUrl}
                              alt={`相簿圖片 ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover/img:scale-108 transition-transform duration-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 轉發原動態卡片 */}
                  {item.orig && (
                    <div className="mt-3 p-3.5 sm:p-4 rounded-xl inner-inset-tray space-y-2 border border-white/[0.08] bg-white/[0.02]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#00aeec] tracking-tight">
                          @{item.orig.authorName || '原創作者'}
                        </span>
                        {item.orig.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400 font-bold">
                            {item.orig.type === 'video' ? '影片' : item.orig.type === 'draw' ? '圖文' : item.orig.type}
                          </span>
                        )}
                      </div>
                      {item.orig.title && (
                        <h5 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                          {item.orig.title}
                        </h5>
                      )}
                      {item.orig.text && (
                        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed text-pretty">
                          {item.orig.text}
                        </p>
                      )}
                      {item.orig.cover && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openLightbox(item.orig!.cover!);
                          }}
                          className="rounded-lg overflow-hidden max-w-sm border border-white/10 bg-slate-900/40 shadow-inner cursor-zoom-in group/orig-cover"
                        >
                          <img
                            src={item.orig.cover.startsWith('//') ? `https:${item.orig.cover}` : item.orig.cover}
                            alt="轉發封面"
                            referrerPolicy="no-referrer"
                            className="w-full aspect-video object-cover group-hover/orig-cover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 底部互動操作欄 (點讚、評論展開、轉發) */}
                  <div className="mt-4 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400 translate-z-10">
                    <div className="flex items-center gap-4">
                      {/* 點讚 */}
                      <span className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                        <ThumbsUp className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold tabular-nums">{item.stat?.like ?? 0}</span>
                      </span>

                      {/* 評論切換按鈕 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleComments(item);
                        }}
                        className={`btn-press flex items-center gap-1.5 px-3 py-1 rounded-full transition-[color,background-color] border ${
                          expandedCommentId === item.id_str
                            ? 'bg-[#fb7299]/20 text-[#fb7299] border-[#fb7299]/40 shadow-[0_0_12px_rgba(251,114,153,0.3)]'
                            : 'bg-white/[0.04] hover:bg-white/[0.09] text-slate-300 hover:text-white border-white/10'
                        }`}
                        title="展開/收起評論區"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#fb7299]" />
                        <span className="font-bold tabular-nums">
                          {item.stat?.reply ? `${item.stat.reply} 條評論` : '評論區'}
                        </span>
                        {expandedCommentId === item.id_str ? (
                          <ChevronUp className="w-3.5 h-3.5 text-[#fb7299]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>

                      {/* 轉發數 */}
                      {item.stat?.forward !== undefined && item.stat.forward > 0 && (
                        <span className="hidden sm:flex items-center gap-1.5 text-slate-500">
                          <Repeat className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{item.stat.forward}</span>
                        </span>
                      )}
                    </div>

                    <a
                      href={dynamicUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-[#fb7299] transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <span>B 站原文</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* 內嵌評論區 (CSS 零卡頓 0fr->1fr 抽屜摺疊架構) */}
                  <div className={`drawer-accordion ${expandedCommentId === item.id_str ? 'is-open' : ''}`}>
                    <div className="drawer-accordion-inner" onClick={(e) => e.stopPropagation()}>
                      <div className="mt-3.5 pt-3.5 border-t border-white/[0.08] space-y-3">
                        {/* 評論載入狀態 */}
                        {commentsState[item.id_str]?.loading && commentsState[item.id_str]?.list.length === 0 ? (
                          <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin text-[#fb7299]" />
                            <span className="text-xs">正在載入評論列表...</span>
                          </div>
                        ) : commentsState[item.id_str]?.error ? (
                          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-2">
                            <p className="text-xs text-red-400">{commentsState[item.id_str]?.error}</p>
                            <button
                              onClick={() => loadComments(item, 1)}
                              className="btn-press px-3 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 text-xs text-red-300 font-bold"
                            >
                              重試載入
                            </button>
                          </div>
                        ) : (commentsState[item.id_str]?.list.length || 0) === 0 ? (
                          <div className="py-6 text-center text-slate-500 text-xs">
                            暫無評論，快去 B 站搶沙發吧！
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* 評論列表 - 帶 Stagger 依序進場動畫 */}
                            {commentsState[item.id_str]?.list.map((c, idx) => (
                              <div 
                                key={c.rpid} 
                                className="comment-item-cascade p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2"
                                style={{ animationDelay: `${Math.min(idx * 35, 210)}ms` }}
                              >
                                {/* 評論作者欄 */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <a
                                      href={`https://space.bilibili.com/${c.mid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex-shrink-0"
                                    >
                                      <img
                                        src={c.avatar || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'}
                                        alt={c.uname}
                                        referrerPolicy="no-referrer"
                                        className="w-7 h-7 rounded-full object-cover border border-white/10 transition-transform duration-200 hover:scale-110"
                                        onError={(e) => {
                                          const target = e.currentTarget;
                                          if (!target.dataset.fallback) {
                                            target.dataset.fallback = '1';
                                            target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                                          }
                                        }}
                                      />
                                    </a>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <a
                                        href={`https://space.bilibili.com/${c.mid}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-bold text-slate-200 hover:text-[#fb7299] transition-colors truncate"
                                      >
                                        {c.uname}
                                      </a>
                                      {c.level > 0 && (
                                        <span
                                          className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                                            c.level >= 6
                                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                              : c.level >= 4
                                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                                          }`}
                                        >
                                          LV{c.level}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <ThumbsUp className="w-3 h-3 text-slate-500" />
                                      <span className="tabular-nums">{c.like}</span>
                                    </span>
                                    <span>{formatTime(c.pubTime)}</span>
                                  </div>
                                </div>

                                {/* 評論內文 */}
                                <p className="text-xs leading-relaxed text-slate-200 pl-9 whitespace-pre-wrap select-text font-normal">
                                  {c.message}
                                </p>

                                {/* 子評論 (二級回覆 1~3 筆) */}
                                {c.subReplies && c.subReplies.length > 0 && (
                                  <div className="ml-9 mt-2 p-2.5 rounded-lg bg-black/20 border border-white/[0.04] space-y-2">
                                    {c.subReplies.slice(0, 3).map((sub) => (
                                      <div key={sub.rpid} className="text-[11px] leading-relaxed">
                                        <span className="font-bold text-[#00aeec] mr-1.5">{sub.uname}:</span>
                                        <span className="text-slate-300">{sub.message}</span>
                                      </div>
                                    ))}
                                    {c.subReplyCount && c.subReplyCount > 3 && (
                                      <div className="text-[10px] text-slate-400 pt-0.5">
                                        共 {c.subReplyCount} 條回覆，可至 B 站查看全部
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* 載入更多評論按鈕 */}
                            {commentsState[item.id_str]?.hasMore && (
                              <div className="text-center pt-1">
                                <button
                                  onClick={() => loadComments(item, (commentsState[item.id_str]?.page || 1) + 1)}
                                disabled={commentsState[item.id_str]?.loading}
                                className="btn-press px-4 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-slate-300 hover:text-white border border-white/10 transition-[color,background-color] inline-flex items-center gap-2"
                              >
                                {commentsState[item.id_str]?.loading && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#fb7299]" />
                                )}
                                <span>加載更多評論 ({commentsState[item.id_str]?.list.length} / {commentsState[item.id_str]?.total})</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card3D>
            );
          })}

          {/* 載入更多 */}
          {hasMore && (
            <div className="text-center pt-6 pb-2">
              <button
                onClick={() => fetchFeed(false)}
                disabled={loadingMore}
                className="btn-press btn-3d btn-nested-pill bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-sm font-black text-slate-200 hover:text-white transition-[transform,background-color,border-color] disabled:opacity-50 shadow-[0_6px_25px_rgba(0,0,0,0.6)]"
              >
                <span>{loadingMore ? '正在載入動態...' : '載入更多動態'}</span>
                <div className="btn-nested-icon">
                  <Sparkles className="w-3.5 h-3.5 text-[#fb7299]" />
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox 圖片全螢幕大圖預覽彈窗 (透過 createPortal 傳送到 document.body 脫離父級 transform / containing block) */}
      {lightbox && typeof document !== 'undefined' && createPortal(
        <div
          onClick={closeLightbox}
          className={`fixed inset-0 z-[9999] bg-black/92 backdrop-blur-xl flex items-center justify-center p-4 select-none cursor-zoom-out ${
            isLightboxClosing ? 'lightbox-exit' : 'lightbox-enter'
          }`}
        >
          {/* 頂部操作與計數欄 */}
          <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-10 sm:px-4">
            {/* 多圖計數標籤 */}
            {lightbox.images.length > 1 ? (
              <div className="px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xl pointer-events-auto">
                {lightbox.currentIndex + 1} / {lightbox.images.length}
              </div>
            ) : <div />}

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* 在新分頁開啟原圖 */}
              <a
                href={lightbox.images[lightbox.currentIndex]}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/15 shadow-xl"
                title="在新分頁開啟原圖"
              >
                <ExternalLink className="w-5 h-5" />
              </a>

              {/* 關閉按鈕 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeLightbox();
                }}
                className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/20 shadow-xl"
                title="關閉預覽 (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 左右切換箭頭 (多圖時呈現) */}
          {lightbox.images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevLightboxImage();
                }}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-white/20 text-white/80 hover:text-white transition-[background-color,transform] border border-white/15 shadow-2xl backdrop-blur-md z-10 active:scale-95 cursor-pointer"
                title="上一張 (←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextLightboxImage();
                }}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-white/20 text-white/80 hover:text-white transition-[background-color,transform] border border-white/15 shadow-2xl backdrop-blur-md z-10 active:scale-95 cursor-pointer"
                title="下一張 (→)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* 圖片展示核心容器 (點擊阻止冒泡關閉) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-[88vh] flex items-center justify-center cursor-default"
          >
            {/* 載入中骨架旋轉指示器 */}
            {isImgLoading && !imgLoadError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 min-w-[200px] min-h-[200px]">
                <Loader2 className="w-9 h-9 animate-spin text-[#fb7299]" />
                <span className="text-xs font-semibold text-slate-300">大圖載入中...</span>
              </div>
            )}

            {/* 載入失敗保底提示 */}
            {imgLoadError ? (
              <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-white/15 max-w-sm text-center shadow-2xl space-y-4">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">大圖無法直接載入</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    可能受 B 站防盜鏈限制或網路連線影響。
                  </p>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <a
                    href={lightbox.images[lightbox.currentIndex]}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#00aeec] hover:bg-[#00bfe8] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-[#00aeec]/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>在新分頁開啟原圖</span>
                  </a>
                  <button
                    onClick={() => {
                      setIsImgLoading(true);
                      setImgLoadError(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>重試</span>
                  </button>
                </div>
              </div>
            ) : (
              <img
                key={lightbox.images[lightbox.currentIndex]}
                src={lightbox.images[lightbox.currentIndex]}
                alt={`大圖預覽 ${lightbox.currentIndex + 1}`}
                referrerPolicy="no-referrer"
                onLoad={() => setIsImgLoading(false)}
                onError={() => {
                  setIsImgLoading(false);
                  setImgLoadError(true);
                }}
                className={`max-w-full max-h-[88vh] rounded-2xl object-contain shadow-[0_25px_70px_rgba(0,0,0,0.95)] border border-white/15 transition-opacity duration-200 ${
                  isImgLoading ? 'opacity-0' : 'opacity-100'
                }`}
              />
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
