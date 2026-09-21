import React, { useState, useEffect } from 'react';
import { 
  Play, 
  MessageSquare, 
  Clock, 
  Search,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client.js';
import type { VideoItem, UpUser } from '../types/index.js';
import { Card3D } from '../components/Card3D.js';

interface VideosViewProps {
  ups: UpUser[];
}

export const VideosView: React.FC<VideosViewProps> = ({ ups }) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMid, setSelectedMid] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'pubdate' | 'click' | 'danmaku' | 'stow'>('pubdate');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 載入關注 UP 主的影片
  const loadVideos = async () => {
    try {
      setLoading(true);
      let allVideos: VideoItem[] = [];
      const safeUps = Array.isArray(ups) ? ups.filter(Boolean) : [];

      if (selectedMid) {
        const res = await api.getUpVideos(selectedMid, 1, 40);
        allVideos = Array.isArray(res?.list) ? res.list : [];
      } else {
        // 全量關注 UP 主最新影片並發抓取
        const promises = safeUps.slice(0, 15).map((up) =>
          api.getUpVideos(up.mid, 1, 10).then((r) => Array.isArray(r?.list) ? r.list : []).catch(() => [])
        );
        const results = await Promise.all(promises);
        allVideos = results.flat();
      }

      setVideos(Array.isArray(allVideos) ? allVideos.filter(Boolean) : []);
    } catch (err) {
      console.error('載入影片失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [selectedMid]);

  const safeVideos = Array.isArray(videos) ? videos.filter(Boolean) : [];
  const safeUps = Array.isArray(ups) ? ups.filter(Boolean) : [];

  // 排序與篩選
  const filteredVideos = safeVideos
    .filter((v) => {
      if (!v) return false;
      if (!searchKeyword.trim()) return true;
      const kw = searchKeyword.toLowerCase();
      const title = (v.title || '').toLowerCase();
      const desc = (v.description || '').toLowerCase();
      const author = (v.author || '').toLowerCase();
      return title.includes(kw) || desc.includes(kw) || author.includes(kw);
    })
    .sort((a, b) => {
      const aPub = Number(a?.pubdate) || 0;
      const bPub = Number(b?.pubdate) || 0;
      const aPlay = Number(a?.play) || 0;
      const bPlay = Number(b?.play) || 0;
      const aDanmaku = Number(a?.videoReview) || 0;
      const bDanmaku = Number(b?.videoReview) || 0;
      const aComment = Number(a?.comment) || 0;
      const bComment = Number(b?.comment) || 0;

      if (sortBy === 'pubdate') return bPub - aPub;
      if (sortBy === 'click') return bPlay - aPlay;
      if (sortBy === 'danmaku') return bDanmaku - aDanmaku;
      if (sortBy === 'stow') return bComment - aComment;
      return 0;
    });

  const formatCount = (count: number | undefined | null) => {
    const num = Number(count) || 0;
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}萬`;
    }
    return num.toLocaleString();
  };

  const formatPubDate = (timestamp: number | undefined | null) => {
    if (!timestamp || isNaN(Number(timestamp))) return '未知日期';
    try {
      const timeSec = Number(timestamp) > 1e11 ? Math.floor(Number(timestamp) / 1000) : Number(timestamp);
      return new Date(timeSec * 1000).toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric'
      });
    } catch {
      return '未知日期';
    }
  };

  return (
    <div className="space-y-6 animate-stagger-1">
      {/* 頂部控制器：UP 選擇 + 排序切換 + 搜尋 (Double-Bezel 雙層托盤結構) */}
      <div className="bezel-shell">
        <div className="bezel-core p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* UP 主橫向滑動列 */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 flex-1">
              <button
                onClick={() => setSelectedMid(null)}
                className={`btn-press focus-ring px-4 py-1.5 rounded-full text-xs font-black transition-[color,background-color,box-shadow] whitespace-nowrap ${
                  selectedMid === null
                    ? 'bg-white text-slate-900 shadow-[0_4px_14px_rgba(255,255,255,0.3)]'
                    : 'bg-white/[0.05] text-slate-400 hover:text-white border border-white/[0.06]'
                }`}
              >
                全體 UP 主
              </button>
              {safeUps.map((up) => (
                <button
                  key={up.mid}
                  onClick={() => setSelectedMid(up.mid)}
                  className={`btn-press focus-ring flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-bold transition-[color,background-color,box-shadow] whitespace-nowrap border ${
                    selectedMid === up.mid
                      ? 'bg-[#00aeec] text-white border-[#00aeec] shadow-[0_4px_16px_rgba(0,174,236,0.5)]'
                      : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] border-white/[0.06]'
                  }`}
                >
                  <img
                    src={up.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'}
                    alt={up.name || `UP主 (${up.mid})`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg';
                    }}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-white/20"
                  />
                  <span className="truncate max-w-[90px] tracking-tight">{up.name || `UP主 (${up.mid})`}</span>
                </button>
              ))}
            </div>

            {/* 搜尋列 */}
            <div className="relative w-full md:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜尋影片標題或簡介..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="focus-ring w-full pl-9 pr-3.5 py-2 bg-white/[0.04] rounded-full text-xs text-white placeholder:text-slate-500 focus:outline-none border border-white/[0.08] transition-[border-color,box-shadow,background-color] shadow-inner"
              />
            </div>
          </div>

          {/* 排序標籤列 */}
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'pubdate', label: '最新發布' },
                { id: 'click', label: '最多播放' },
                { id: 'danmaku', label: '最多彈幕' },
                { id: 'stow', label: '最多評論/收藏' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id as any)}
                  className={`btn-press focus-ring px-3.5 py-1.5 rounded-full text-xs font-bold transition-[color,background-color] ${
                    sortBy === s.id
                      ? 'bg-gradient-to-b from-white/20 to-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-white/15'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="tracking-tight">{s.label}</span>
                </button>
              ))}
            </div>

            <span className="tabular-nums text-xs text-slate-400 font-bold px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/5">
              共 {filteredVideos.length} 部影片
            </span>
          </div>
        </div>
      </div>

      {/* 影片 3D 浮雕網格 (Double-Bezel 雙層工藝嵌套) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bezel-shell">
              <div className="bezel-core overflow-hidden p-0 space-y-3">
                <div className="aspect-video w-full shimmer-skeleton" />
                <div className="p-4 space-y-3">
                  <div className="w-full h-4 shimmer-skeleton rounded-md" />
                  <div className="w-3/4 h-4 shimmer-skeleton rounded-md" />
                  <div className="flex justify-between items-center pt-2">
                    <div className="w-24 h-3 shimmer-skeleton rounded-md" />
                    <div className="w-16 h-3 shimmer-skeleton rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="bezel-shell">
          <div className="bezel-core p-16 text-center text-slate-400 space-y-4 border-dashed border-white/10">
            <div className="w-16 h-16 squircle bg-gradient-to-tr from-[#00aeec]/20 to-[#fb7299]/20 flex items-center justify-center mx-auto border border-white/10 shadow-[0_0_25px_rgba(0,174,236,0.2)]">
              <Sparkles className="w-8 h-8 text-[#00aeec]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-100 tracking-tight">未找到相符影片</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                嘗試調整搜尋關鍵字、選擇全部 UP 主，或切換排序方式。
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedMid(null);
                setSearchKeyword('');
                setSortBy('pubdate');
              }}
              className="btn-press btn-3d btn-3d-blue px-6 py-2.5 rounded-full text-xs font-black text-white inline-flex items-center gap-2 shadow-[0_4px_16px_rgba(0,174,236,0.45)]"
            >
              <span>清除搜尋條件</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 perspective-container content-reveal">
          {filteredVideos.map((video, idx) => (
            <Card3D
              key={video.bvid}
              intensity={12}
              glowColor="rgba(0, 174, 236, 0.18)"
              containerClassName={`animate-stagger-${Math.min(idx + 1, 5)} flex flex-col card-content-visibility`}
              className="bezel-shell flex flex-col h-full group"
            >
              <a
                href={`https://www.bilibili.com/video/${video.bvid}`}
                target="_blank"
                rel="noreferrer"
                className="bezel-core overflow-hidden flex flex-col h-full relative preserve-3d"
              >
                {/* 科技角標飾線 (Cyberpunk HUD Brackets) */}
                <div className="pointer-events-none absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-[#00aeec]/50 rounded-tl-sm z-30" />
                <div className="pointer-events-none absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-[#00aeec]/50 rounded-tr-sm z-30" />

                {/* 影片封面圖與時長 Badge (translate-z-20 帶鏡面流光) */}
                <div className="sheen-wrapper relative aspect-video overflow-hidden bg-slate-950 flex-shrink-0 translate-z-20 shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
                  <img
                    src={video.pic}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  
                  {/* 播放按鈕懸浮特效 (translate-z-40，Apple 彈簧手感放大彈跳) */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-z-40 pointer-events-none">
                    <div className="w-13 h-13 squircle bg-[#00aeec] text-white flex items-center justify-center shadow-[0_6px_25px_rgba(0,174,236,0.85)] transform scale-95 group-hover:scale-115 transition-transform duration-300 ease-[var(--ease-spring)]">
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* 底部數據與時長 (translate-z-35 實體壓克力微晶片膠囊標牌) */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-white font-bold drop-shadow tabular-nums translate-z-35">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 acrylic-badge px-2 py-0.5 rounded-md">
                        <Play className="w-3.5 h-3.5 text-[#00aeec]" /> {formatCount(video.play)}
                      </span>
                      <span className="flex items-center gap-1 acrylic-badge px-2 py-0.5 rounded-md">
                        <MessageSquare className="w-3.5 h-3.5 text-[#fb7299]" /> {formatCount(video.videoReview)}
                      </span>
                    </div>
                    <span className="acrylic-badge px-2.5 py-0.5 rounded-md font-mono text-[10px] text-slate-200">
                      {video.duration}
                    </span>
                  </div>
                </div>

                {/* 影片標題與 UP 主資訊 (translate-z-30, 底線對齊 mt-auto) */}
                <div className="p-4 sm:p-5 flex flex-col flex-1 translate-z-30">
                  <h3 className="font-bold text-sm sm:text-base text-white line-clamp-2 leading-snug group-hover:text-[#00aeec] transition-colors tracking-tight text-balance mb-3">
                    {video.title}
                  </h3>

                  <div className="mt-auto flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-white/[0.06] tabular-nums">
                    <span className="font-bold text-slate-300 truncate max-w-[130px] tracking-tight group-hover:text-white transition-colors">{video.author}</span>
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatPubDate(video.pubdate)}</span>
                    </div>
                  </div>
                </div>
              </a>
            </Card3D>
          ))}
        </div>
      )}
    </div>
  );
};
