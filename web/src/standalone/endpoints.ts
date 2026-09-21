import { biliFetch } from './biliClient.js';
import { signWbiParams } from './wbi.js';
import type { DynamicItem, DynamicType, LiveStatusInfo, VideoItem, CommentItem, CommentsResult } from '../types/index.js';

export interface ResolveResult {
  mid: number;
  sourceType: 'mid' | 'space_url' | 'b23_tv' | 'bvid';
  sourceInput: string;
}

/**
 * 解析 UP 主輸入
 */
export async function resolveUp(input: string): Promise<ResolveResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('請輸入有效的 UP 主識別字串 (UID、空間網址或影片 BV 號)');
  }

  // 1. 純數字 UID
  if (/^\d+$/.test(trimmed)) {
    return {
      mid: parseInt(trimmed, 10),
      sourceType: 'mid',
      sourceInput: trimmed
    };
  }

  // 2. space.bilibili.com/{mid}
  const spaceMatch = trimmed.match(/space\.bilibili\.com\/(\d+)/i);
  if (spaceMatch && spaceMatch[1]) {
    return {
      mid: parseInt(spaceMatch[1], 10),
      sourceType: 'space_url',
      sourceInput: trimmed
    };
  }

  // 3. b23.tv 短網址
  if (/b23\.tv/i.test(trimmed)) {
    let targetUrl = trimmed;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    try {
      await biliFetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
      });
      // 在純前端若無法解析重定向，嘗試提示使用者輸入空間網址或UID
      throw new Error('b23.tv 短網址解析需要重定向，請直接輸入 UP 主 UID 或空間網址');
    } catch (err: any) {
      throw new Error(`無法解析 b23.tv 短網址: ${err.message}`);
    }
  }

  // 4. BV 號匹配 (BV1xxxxxxxxx)
  const bvMatch = trimmed.match(/(BV[0-9A-Za-z]{10})/i);
  if (bvMatch && bvMatch[1]) {
    const bvid = bvMatch[1];
    const viewApi = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const res = await biliFetch<any>(viewApi, { ttlMs: 60 * 60 * 1000 });
    if (res?.code === 0 && res.data?.owner?.mid) {
      return {
        mid: res.data.owner.mid,
        sourceType: 'bvid',
        sourceInput: bvid
      };
    }
    throw new Error(`無法從 BV 號 ${bvid} 取得 UP 主資訊 (code: ${res?.code})`);
  }

  throw new Error(`無法辨識的輸入格式: "${trimmed}"，請輸入 UID、個人空間連結或影片 BV 號`);
}

/**
 * 取得 UP 主基本個人資料
 * 雙保險機制：
 * 優先呼叫帶 WBI 簽名的 /x/space/wbi/acc/info?mid=
 * 若遭遇 -352 或其他風控攔截，自動降級呼叫免登入的 /x/web-interface/card?mid=
 */
export async function getUpInfo(mid: number): Promise<any> {
  // 嘗試 WBI 端點
  try {
    const signedQuery = await signWbiParams({ mid });
    const url = `https://api.bilibili.com/x/space/wbi/acc/info?${signedQuery}`;
    const res = await biliFetch<any>(url, {
      ttlMs: 5 * 60 * 1000,
      headers: {
        Referer: `https://space.bilibili.com/${mid}/`
      }
    });

    if (res?.code === 0 && res.data?.mid) {
      return res.data;
    }
  } catch (err) {
    console.warn(`[Standalone Endpoints] getUpInfo WBI 呼叫失敗，啟用 card 平滑降級:`, err);
  }

  // 平滑降級：呼叫 /x/web-interface/card
  const cardUrl = `https://api.bilibili.com/x/web-interface/card?mid=${mid}&photo=true`;
  const cardRes = await biliFetch<any>(cardUrl, {
    ttlMs: 5 * 60 * 1000,
    headers: {
      Referer: `https://space.bilibili.com/${mid}/`
    }
  });

  if (cardRes?.code === 0 && cardRes.data?.card) {
    const c = cardRes.data.card;
    return {
      mid: parseInt(c.mid, 10),
      name: c.name,
      sex: c.sex,
      face: c.face,
      sign: c.sign,
      level: c.level_info?.current_level || 0,
      official: c.Official ? {
        role: c.Official.role,
        title: c.Official.title,
        desc: c.Official.desc,
        type: c.Official.type
      } : undefined,
      live_room: cardRes.data.live
        ? {
            roomStatus: 1,
            liveStatus: cardRes.data.live.liveStatus,
            url: cardRes.data.live.url,
            title: cardRes.data.live.title,
            cover: cardRes.data.live.cover,
            online: cardRes.data.live.online,
            roomid: cardRes.data.live.roomid,
            roundStatus: 0,
            broadcastType: 0
          }
        : undefined
    };
  }

  throw new Error(`無法取得 UP 主資料 (mid: ${mid})`);
}

/**
 * 輔助函數：將秒數時長轉換為 mm:ss 或 hh:mm:ss 格式字串
 */
function formatDuration(seconds: number | string): string {
  const sec = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  if (isNaN(sec) || sec <= 0) return typeof seconds === 'string' ? seconds : '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 免 WBI、免風控端點：透過 UP 主空間 medialist 資源列表獲取投稿影片 (供 Standalone 模式使用)
 * API: https://api.bilibili.com/x/v2/medialist/resource/list?type=1&biz_id={mid}
 */
export async function fetchVideosViaMediaList(
  mid: number,
  pn = 1,
  ps = 30
): Promise<{ list: VideoItem[]; total: number }> {
  const url = `https://api.bilibili.com/x/v2/medialist/resource/list?type=1&biz_id=${mid}&ps=${ps}&pn=${pn}`;
  const res = await biliFetch<any>(url, {
    ttlMs: 2 * 60 * 1000,
    headers: {
      Referer: `https://space.bilibili.com/${mid}/video`
    }
  });

  if (res?.code === 0 && Array.isArray(res.data?.media_list)) {
    const mediaList: any[] = res.data.media_list;
    const list: VideoItem[] = mediaList.map((v) => ({
      bvid: v.bv_id || '',
      aid: v.id || 0,
      title: v.title || '',
      description: v.intro || '',
      pic: v.cover?.startsWith('http') ? v.cover : (v.cover ? `https:${v.cover}` : ''),
      duration: formatDuration(v.duration),
      pubdate: v.pubtime || 0,
      created: v.pubtime || 0,
      play: v.cnt_info?.play || 0,
      videoReview: v.cnt_info?.danmaku || 0,
      comment: v.cnt_info?.reply || 0,
      author: v.upper?.name || '',
      mid: v.upper?.mid || mid
    }));
    return { list, total: res.data.total_count ?? list.length };
  }

  throw new Error(`medialist 介面傳回非0狀態碼: ${res?.code}`);
}

/**
 * 底層原始空間動態獲取 (不包含任何跨端點回退，避免循環依賴)
 */
export async function fetchRawDynamics(
  mid: number,
  offset = ''
): Promise<{ items: DynamicItem[]; offset: string; hasMore: boolean }> {
  const params: Record<string, any> = { host_mid: mid };
  if (offset) params.offset = offset;

  const signedQuery = await signWbiParams(params);
  const url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${signedQuery}`;
  const res = await biliFetch<any>(url, {
    ttlMs: 60 * 1000,
    headers: {
      Referer: `https://space.bilibili.com/${mid}/dynamic`
    }
  });

  if (res?.code === 0) {
    const rawItems: any[] = res.data?.items || [];
    const parsedItems: DynamicItem[] = [];

    for (const item of rawItems) {
      const parsed = parseDynamicItem(item, mid);
      if (parsed) {
        parsedItems.push(parsed);
      }
    }

    return {
      items: parsedItems,
      offset: res.data?.offset || '',
      hasMore: res.data?.has_more || false
    };
  }

  return { items: [], offset: '', hasMore: false };
}

/**
 * 降級方案：從空間底層動態串流中提取視頻 (純淨提取，嚴禁再回調 getUpVideos)
 */
async function fallbackExtractVideosFromRawDynamics(
  mid: number
): Promise<{ list: VideoItem[]; total: number }> {
  try {
    const dynamics = await fetchRawDynamics(mid);
    const videoDynamics = dynamics.items.filter((d) => d.type === 'video' && d.bvid);

    const list: VideoItem[] = videoDynamics.map((item) => ({
      bvid: item.bvid || '',
      aid: 0,
      title: item.title || item.text || '最新影片',
      description: item.text || '',
      pic: item.cover || '',
      duration: '',
      pubdate: Math.round(item.pubTime / 1000),
      created: Math.round(item.pubTime / 1000),
      play: 0,
      videoReview: 0,
      comment: 0,
      author: item.authorName,
      mid: item.mid
    }));

    return { list, total: list.length };
  } catch {
    return { list: [], total: 0 };
  }
}

/**
 * 取得 UP 主投稿影片列表 (帶 WBI 簽名)
 * 多層平滑降級策略：
 * 1. 優先調用帶完整參數與 WBI 簽名的 /x/space/wbi/arc/search
 * 2. 若遭遇 -352 或風控錯誤，自動無縫降級至免 WBI 的 /x/v2/medialist/resource/list
 * 3. 若仍失敗，降級從底層原始動態串流中抽取影片卡片 (切斷循環依賴)
 */
export async function getUpVideos(
  mid: number,
  pn = 1,
  ps = 30,
  order = 'pubdate'
): Promise<{ list: VideoItem[]; total: number }> {
  // 1. 優先嘗試官方 WBI 影片搜尋端點 (補齊 keyword, order_avoided, web_location)
  try {
    const signedQuery = await signWbiParams({
      mid,
      ps,
      tid: 0,
      pn,
      order,
      keyword: '',
      order_avoided: 'true',
      web_location: 1550101
    });
    const url = `https://api.bilibili.com/x/space/wbi/arc/search?${signedQuery}`;
    const res = await biliFetch<any>(url, {
      ttlMs: 2 * 60 * 1000,
      headers: {
        Referer: `https://space.bilibili.com/${mid}/video`
      }
    });

    if (res?.code === 0 && res.data?.list?.vlist) {
      const vlist: any[] = res.data.list.vlist;
      const list: VideoItem[] = vlist.map((v) => ({
        bvid: v.bvid,
        aid: v.aid,
        title: v.title,
        description: v.description,
        pic: v.pic?.startsWith('http') ? v.pic : `https:${v.pic}`,
        duration: v.length || '',
        pubdate: v.created || v.pubdate || 0,
        created: v.created || v.pubdate || 0,
        play: v.play || 0,
        videoReview: v.video_review || 0,
        comment: v.comment || 0,
        author: v.author || '',
        mid: v.mid || mid
      }));
      return { list, total: res.data.page?.count ?? list.length };
    }
  } catch {
    // 遇到 -352 或其他風控時靜默進入下一級降級
  }

  // 2. 第一優雅降級：免 WBI 風控的 medialist 空間資源列表
  try {
    const mediaResult = await fetchVideosViaMediaList(mid, pn, ps);
    if (mediaResult.list.length > 0) {
      return mediaResult;
    }
  } catch {}

  // 3. 第二降級方案：從底層空間動態中安全提取影片卡片 (絕不回調 getUpVideos)
  return await fallbackExtractVideosFromRawDynamics(mid);
}

/**
 * 取得 UP 主空間動態 (動態串流 API，帶 WBI 簽名)
 * 雙保險機制：
 * 1. 優先從底層空間動態串流 API 獲取
 * 2. 若動態列表為空或失敗，自動降級從影片投稿中產生動態卡片
 */
export async function getUpDynamics(
  mid: number,
  offset = ''
): Promise<{ items: DynamicItem[]; offset: string; hasMore: boolean }> {
  try {
    const rawDynamics = await fetchRawDynamics(mid, offset);
    if (rawDynamics.items.length > 0) {
      return rawDynamics;
    }
  } catch {}

  // 降級處理 (從影片投稿中降級產生動態列表，此時 getUpVideos 具備免 WBI 兜底且不回調 getUpDynamics)
  try {
    const videos = await getUpVideos(mid, 1, 10);
    if (videos.list.length === 0) {
      return { items: [], offset: '', hasMore: false };
    }

    let authorFace = '';
    let authorName = '';
    try {
      const upInfo = await getUpInfo(mid);
      authorFace = upInfo.face || '';
      authorName = upInfo.name || '';
    } catch {}

    if (authorFace && authorFace.startsWith('//')) {
      authorFace = `https:${authorFace}`;
    }

    const fakeDynamics: DynamicItem[] = videos.list.map((v) => ({
      id_str: `video_${v.bvid}`,
      type: 'video',
      mid: v.mid || mid,
      authorName: v.author || authorName,
      authorFace: authorFace || '',
      pubTime: v.pubdate ? v.pubdate * 1000 : Date.now(),
      text: v.description,
      title: v.title,
      cover: v.pic?.startsWith('//') ? `https:${v.pic}` : v.pic,
      jumpUrl: `https://www.bilibili.com/video/${v.bvid}`,
      bvid: v.bvid,
      commentId: v.aid > 0 ? String(v.aid) : undefined,
      commentType: v.aid > 0 ? 1 : undefined
    }));
    return { items: fakeDynamics, offset: '', hasMore: false };
  } catch {
    return { items: [], offset: '', hasMore: false };
  }
}

function parseDynamicItem(item: any, fallbackMid: number): DynamicItem | null {
  if (!item || !item.id_str) return null;

  const typeStr: string = item.type || '';
  const author = item.modules?.module_author || {};
  const dynamic = item.modules?.module_dynamic || {};
  const major = dynamic?.major || {};
  const desc = dynamic?.desc || {};

  let dType: DynamicType = 'other';
  let title = '';
  let text = desc.text || '';
  let cover = '';
  let bvid = '';
  const images: string[] = [];
  let jumpUrl = '';

  if (typeStr === 'DYNAMIC_TYPE_AV' || major.archive) {
    dType = 'video';
    const arc = major.archive || {};
    title = arc.title || '';
    cover = arc.cover || '';
    bvid = arc.bvid || '';
    jumpUrl = arc.jump_url ? (arc.jump_url.startsWith('//') ? `https:${arc.jump_url}` : arc.jump_url) : `https://www.bilibili.com/video/${bvid}`;
    if (!text && arc.desc) text = arc.desc;
  } else if (typeStr === 'DYNAMIC_TYPE_ARTICLE' || major.article) {
    dType = 'article';
    const art = major.article || {};
    title = art.title || '';
    cover = art.covers?.[0] || '';
    jumpUrl = art.jump_url?.startsWith('//') ? `https:${art.jump_url}` : art.jump_url;
  } else if (typeStr === 'DYNAMIC_TYPE_DRAW' || major.draw) {
    dType = 'draw';
    const draw = major.draw || {};
    if (Array.isArray(draw.items)) {
      for (const img of draw.items) {
        if (img.src) images.push(img.src);
      }
      cover = images[0] || '';
    }
  } else if (typeStr === 'DYNAMIC_TYPE_OPUS' || major.opus) {
    const opus = major.opus || {};
    if (opus.pics && Array.isArray(opus.pics)) {
      dType = 'draw';
      for (const p of opus.pics) {
        if (p.url) images.push(p.url);
      }
      cover = images[0] || '';
    } else {
      dType = 'text';
    }
    title = opus.title || '';
    if (!text && opus.summary?.text) {
      text = opus.summary.text;
    }
    jumpUrl = opus.jump_url ? (opus.jump_url.startsWith('//') ? `https:${opus.jump_url}` : opus.jump_url) : '';
  } else if (typeStr === 'DYNAMIC_TYPE_WORD') {
    dType = 'text';
  } else if (typeStr === 'DYNAMIC_TYPE_FORWARD') {
    dType = 'forward';
  }

  // 7. 直播動態 (DYNAMIC_TYPE_LIVE_RCMD 或 DYNAMIC_TYPE_LIVE 或 major.live_rcmd / major.live)
  let liveInfo: DynamicItem['liveInfo'] = undefined;
  if (typeStr === 'DYNAMIC_TYPE_LIVE_RCMD' || typeStr === 'DYNAMIC_TYPE_LIVE' || major.live_rcmd || major.live) {
    dType = 'live';
    let livePlayInfo: any = undefined;
    if (major.live_rcmd) {
      if (major.live_rcmd.live_play_info) {
        livePlayInfo = major.live_rcmd.live_play_info;
      } else if (major.live_rcmd.content) {
        try {
          const parsedContent = typeof major.live_rcmd.content === 'string'
            ? JSON.parse(major.live_rcmd.content)
            : major.live_rcmd.content;
          livePlayInfo = parsedContent?.live_play_info || parsedContent;
        } catch {}
      }
    }

    if (livePlayInfo) {
      const roomId = Number(livePlayInfo.room_id || 0);
      const liveTitle = livePlayInfo.title || '';
      const liveCover = livePlayInfo.cover || '';
      const areaName = livePlayInfo.area_name || '';
      const watchedShow = livePlayInfo.watched_show?.text_large || livePlayInfo.watched_show?.num || (livePlayInfo.watched_show?.text_small ? `${livePlayInfo.watched_show.text_small}人看过` : undefined);
      const liveStatus = livePlayInfo.live_status !== undefined ? livePlayInfo.live_status : 1;
      const link = livePlayInfo.link ? (livePlayInfo.link.startsWith('//') ? `https:${livePlayInfo.link}` : livePlayInfo.link) : (roomId ? `https://live.bilibili.com/${roomId}` : undefined);

      liveInfo = {
        room_id: roomId,
        title: liveTitle,
        cover: liveCover.startsWith('//') ? `https:${liveCover}` : liveCover,
        area_name: areaName,
        watched_show: watchedShow ? String(watchedShow) : undefined,
        live_status: liveStatus,
        link
      };

      if (!title) title = liveTitle;
      if (!cover) cover = liveInfo.cover;
      if (!jumpUrl && link) jumpUrl = link;
    } else if (major.live) {
      const l = major.live;
      const roomId = Number(l.id || l.room_id || 0);
      const liveTitle = l.title || '';
      const liveCover = l.cover || '';
      const areaName = l.badge?.text || '';
      const liveStatus = l.live_state !== undefined ? l.live_state : 1;
      const link = l.jump_url ? (l.jump_url.startsWith('//') ? `https:${l.jump_url}` : l.jump_url) : (roomId ? `https://live.bilibili.com/${roomId}` : undefined);

      liveInfo = {
        room_id: roomId,
        title: liveTitle,
        cover: liveCover.startsWith('//') ? `https:${liveCover}` : liveCover,
        area_name: areaName,
        live_status: liveStatus,
        link
      };

      if (!title) title = liveTitle;
      if (!cover) cover = liveInfo.cover;
      if (!jumpUrl && link) jumpUrl = link;
    }
  }

  // 互動統計數據 (module_stat)
  const moduleStat = item.modules?.module_stat;
  const stat = moduleStat ? {
    reply: moduleStat.comment?.count ?? 0,
    like: moduleStat.like?.count ?? 0,
    forward: moduleStat.forward?.count ?? 0
  } : undefined;

  // 評論參數解析（comment_type 可能是數字或字串，正規化為數字）
  let commentId = item.basic?.comment_id_str != null ? String(item.basic.comment_id_str) : undefined;
  let commentType = item.basic?.comment_type != null ? Number(item.basic.comment_type) : undefined;
  if (commentType !== undefined && Number.isNaN(commentType)) {
    commentType = undefined;
  }
  if (!commentId) {
    if (dType === 'video' && major.archive?.aid) {
      commentId = String(major.archive.aid);
      commentType = 1;
    } else {
      commentId = item.id_str;
      commentType = commentType ?? 11;
    }
  }
  if (commentType === undefined) {
    commentType = dType === 'video' ? 1 : 11;
  }

  let origData: DynamicItem['orig'] = undefined;
  if (item.orig) {
    const origParsed = parseDynamicItem(item.orig, 0);
    if (origParsed) {
      origData = {
        id_str: origParsed.id_str,
        type: origParsed.type,
        mid: origParsed.mid,
        authorName: origParsed.authorName,
        text: origParsed.text,
        title: origParsed.title,
        cover: origParsed.cover,
        bvid: origParsed.bvid
      };
    }
  }

  // 解析 UP 主頭像 (兼顧不同版本 B 站動態結構與協議前綴)
  let authorFace = author.face || '';
  if (!authorFace && author.avatar) {
    if (typeof author.avatar === 'string') {
      authorFace = author.avatar;
    } else if (author.avatar?.container_size?.layers?.[0]?.general_spec?.web_css_resource?.image) {
      authorFace = author.avatar.container_size.layers[0].general_spec.web_css_resource.image;
    } else if (author.avatar?.fallback_layers?.layers?.[0]?.general_spec?.web_css_resource?.image) {
      authorFace = author.avatar.fallback_layers.layers[0].general_spec.web_css_resource.image;
    }
  }
  if (!authorFace && author.avatar_url) {
    authorFace = author.avatar_url;
  }
  if (authorFace && authorFace.startsWith('//')) {
    authorFace = `https:${authorFace}`;
  }

  return {
    id_str: item.id_str,
    type: dType,
    rawType: typeStr,
    mid: author.mid || fallbackMid,
    authorName: author.name || '',
    authorFace: authorFace || '',
    pubTime: author.pub_ts ? author.pub_ts * 1000 : Date.now(),
    pubAction: author.pub_action || undefined,
    text,
    title,
    cover,
    images: images.length > 0 ? images : undefined,
    jumpUrl: jumpUrl || `https://t.bilibili.com/${item.id_str}`,
    bvid: bvid || undefined,
    liveInfo,
    commentId,
    commentType,
    stat,
    orig: origData
  };
}

/**
 * B 站評論區單頁上限（實測 ps > 20 即回 -400 "ps out of bounds"）
 */
const COMMENT_PAGE_SIZE_MAX = 20;

/**
 * 將 B 站評論介面錯誤碼轉為使用者可讀原因
 * （B 站 message 欄位常為編碼亂碼，不直接透傳給前端）
 */
function describeCommentError(code: unknown): string {
  switch (code) {
    case -400:
      return '評論請求參數錯誤（B站 code -400），該內容可能不支援站內評論';
    case -404:
      return '該內容暫無評論區或評論已關閉（B站 code -404）';
    case 12002:
      return '該動態評論區已關閉（B站 code 12002）';
    case -352:
    case 412:
      return '觸發 B 站風控，請稍後再試';
    default:
      return `B站評論介面異常（code: ${String(code)}），請稍後重試`;
  }
}

/**
 * 取得 B 站評論列表 (免登入端點，供 Standalone 模式使用)
 * type: 1 (影片), 11 (相簿/動態), 17 (文字動態/分享)
 * oid: 評論對象 id (視頻為 aid, 動態為 dynamic_id / comment_id)
 *
 * 失敗時不再靜默回空列表，而是攜帶 error 原因，
 * 讓前端能區分「真的沒評論」與「載入失敗」。
 */
export async function getComments(
  type: number,
  oid: string,
  page = 1,
  pageSize = 20
): Promise<CommentsResult> {
  const cleanOid = typeof oid === 'string' ? oid.trim() : String(oid ?? '').trim();
  if (!cleanOid) {
    return { list: [], total: 0, hasMore: false, error: '缺少評論區參數（oid 為空）' };
  }

  const safeType = Number(type);
  if (!Number.isFinite(safeType)) {
    return { list: [], total: 0, hasMore: false, error: '評論類型參數錯誤' };
  }

  const parsedPage = Math.floor(Number(page));
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedSize = Math.floor(Number(pageSize));
  const safePageSize = Number.isFinite(parsedSize)
    ? Math.min(Math.max(parsedSize, 1), COMMENT_PAGE_SIZE_MAX)
    : COMMENT_PAGE_SIZE_MAX;

  try {
    const url = `https://api.bilibili.com/x/v2/reply?type=${safeType}&oid=${encodeURIComponent(cleanOid)}&pn=${safePage}&ps=${safePageSize}&sort=2`;
    const res = await biliFetch<any>(url, {
      ttlMs: 30 * 1000,
      headers: {
        Referer: 'https://www.bilibili.com'
      }
    });

    if (res?.code === 0 && res.data) {
      const pageInfo = res.data.page || {};
      const total = pageInfo.count || 0;
      const replies: any[] = res.data.replies || [];

      const list: CommentItem[] = replies.map((r) => {
        const subReplies: CommentItem[] = Array.isArray(r.replies)
          ? r.replies.map((sub: any) => ({
              rpid: String(sub.rpid),
              mid: sub.mid,
              uname: sub.member?.uname || '',
              avatar: sub.member?.avatar?.startsWith('//') ? `https:${sub.member.avatar}` : (sub.member?.avatar || ''),
              level: sub.member?.level_info?.current_level ?? 0,
              pubTime: sub.ctime ? sub.ctime * 1000 : Date.now(),
              like: sub.like || 0,
              message: sub.content?.message || ''
            }))
          : [];

        return {
          rpid: String(r.rpid),
          mid: r.mid,
          uname: r.member?.uname || '',
          avatar: r.member?.avatar?.startsWith('//') ? `https:${r.member.avatar}` : (r.member?.avatar || ''),
          level: r.member?.level_info?.current_level ?? 0,
          pubTime: r.ctime ? r.ctime * 1000 : Date.now(),
          like: r.like || 0,
          message: r.content?.message || '',
          subReplies: subReplies.length > 0 ? subReplies : undefined,
          subReplyCount: r.rcount || subReplies.length || 0
        };
      });

      const hasMore = safePage * safePageSize < total;
      return { list, total, hasMore };
    }

    console.warn(`[Standalone Endpoints] getComments 非0回應 (type: ${safeType}, oid: ${cleanOid}, code: ${res?.code})`);
    return { list: [], total: 0, hasMore: false, error: describeCommentError(res?.code) };
  } catch (err) {
    console.warn(`[Standalone Endpoints] getComments 失敗 (type: ${safeType}, oid: ${cleanOid}):`, err);
    return { list: [], total: 0, hasMore: false, error: '評論載入失敗（網路異常），請檢查連線後重試' };
  }
}

/**
 * 批次取得多個 UP 主的直播間狀態
 */
export async function getLiveStatusBatch(uids: number[]): Promise<Record<number, LiveStatusInfo>> {
  if (!uids || uids.length === 0) {
    return {};
  }

  const url = 'https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids';

  try {
    const res = await biliFetch<any>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://live.bilibili.com/'
      },
      body: { uids }
    });

    if (res?.code === 0 && res.data) {
      const result: Record<number, LiveStatusInfo> = {};
      for (const [uidStr, info] of Object.entries(res.data)) {
        const uid = parseInt(uidStr, 10);
        const item = info as any;
        result[uid] = {
          uid,
          room_id: item.room_id || 0,
          title: item.title || '',
          cover_from_user: item.cover_from_user || '',
          keyframe: item.keyframe || '',
          live_status: item.live_status ?? 0,
          live_time: item.live_time || '',
          online: item.online || 0,
          area_name: item.area_v2_name || item.area_name || '',
          parent_area_name: item.area_v2_parent_name || item.parent_area_name || '',
          uname: item.uname,
          face: item.face
        };
      }
      return result;
    }

    return {};
  } catch (err) {
    console.error('[Standalone Endpoints] 批次獲取直播狀態失敗:', err);
    return {};
  }
}
