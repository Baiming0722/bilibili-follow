export interface UpUser {
  mid: number;
  name: string;
  face: string;
  sign: string;
  sex: string;
  level: number;
  isSeniorMember?: number;
  official?: {
    role: number;
    title: string;
    desc: string;
    type: number;
  };
  liveRoom?: {
    roomStatus: number;
    liveStatus: number; // 0: 未開播, 1: 直播中, 2: 輪播中
    url: string;
    title: string;
    cover: string;
    online: number;
    roomid: number;
  };
  customNote?: string;
  tags?: string[];
  isPinned?: boolean;
  pinOrder?: number;
  notifyOnLive?: boolean;
  notifyOnVideo?: boolean;
  notifyOnDynamic?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VideoItem {
  bvid: string;
  aid: number;
  title: string;
  description: string;
  pic: string;
  duration: string;
  pubdate: number;
  created: number;
  play: number;
  videoReview: number;
  comment: number;
  author: string;
  mid: number;
}

export type DynamicType = 'video' | 'article' | 'draw' | 'text' | 'forward' | 'live' | 'other';

export interface DynamicItem {
  id_str: string;
  type: DynamicType;
  rawType?: string;
  mid: number;
  authorName: string;
  authorFace: string;
  pubTime: number;
  pubAction?: string;
  text?: string;
  title?: string;
  cover?: string;
  images?: string[];
  jumpUrl?: string;
  bvid?: string;
  liveInfo?: {
    room_id: number;
    title: string;
    cover: string;
    area_name: string;
    watched_show?: string;
    live_status?: number;
    link?: string;
  };
  commentId?: string;
  commentType?: number;
  stat?: {
    reply: number;
    like: number;
    forward: number;
  };
  orig?: {
    id_str: string;
    type: DynamicType;
    mid: number;
    authorName: string;
    text?: string;
    title?: string;
    cover?: string;
    bvid?: string;
  };
}

export interface CommentItem {
  rpid: string;
  mid: number;
  uname: string;
  avatar: string;
  level: number;
  pubTime: number;
  like: number;
  message: string;
  subReplies?: CommentItem[];
  subReplyCount?: number;
}

export interface CommentsResult {
  list: CommentItem[];
  total: number;
  hasMore: boolean;
  /** B 站非 0 回應或網路異常時的人類可讀原因；成功且有資料時為空 */
  error?: string;
}

export interface LiveStatusInfo {
  uid: number;
  room_id: number;
  title: string;
  cover_from_user: string;
  keyframe: string;
  live_status: number;
  live_time: string;
  online: number;
  area_name: string;
  parent_area_name: string;
  uname?: string;
  face?: string;
}

export interface AppSettings {
  pollIntervalLiveSec: number;
  pollIntervalDynamicSec: number;
  enableNotifications: boolean;
  notifyLive: boolean;
  notifyVideo: boolean;
  notifyDynamic: boolean;
  soundEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  customProxyUrl?: string;
}
