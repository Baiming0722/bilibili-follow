import { md5 } from './md5.js';
import { biliFetch } from './biliClient.js';

// B站 WBI mixinKey 查表常數 (64 字符重組順序)
const MIXIN_KEY_ENC_TAB: number[] = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52
];

interface WbiKeys {
  img_key: string;
  sub_key: string;
  fetchedAt: number;
}

const STORAGE_KEY_WBI = 'bili_standalone_wbi_keys';
let cachedWbiKeys: WbiKeys | null = null;
const WBI_KEY_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 小時快取

// 初始化時嘗試從 localStorage 載入快取的 WBI Key
try {
  const saved = localStorage.getItem(STORAGE_KEY_WBI);
  if (saved) {
    cachedWbiKeys = JSON.parse(saved);
  }
} catch {}

/**
 * 根據查表重組取得 mixin_key
 */
export function getMixinKey(orig: string): string {
  let temp = '';
  for (const idx of MIXIN_KEY_ENC_TAB) {
    if (idx < orig.length) {
      temp += orig[idx];
    }
  }
  return temp.slice(0, 32);
}

/**
 * 對參數執行純前端 WBI 簽名計算
 * 1. 加入當前時間戳 wts
 * 2. 按照 key 字典序排序
 * 3. 濾除非法字符
 * 4. 拼接 mixin_key 計算 md5 得到 w_rid
 */
export function encWbi(
  params: Record<string, any>,
  imgKey: string,
  subKey: string
): Record<string, any> {
  const mixinKey = getMixinKey(imgKey + subKey);
  const currTime = Math.round(Date.now() / 1000);
  const newParams: Record<string, any> = { ...params, wts: currTime };

  // 按照 key 字母順序排序
  const keys = Object.keys(newParams).sort();
  const queryParts: string[] = [];

  for (const key of keys) {
    const val = newParams[key];
    if (val === undefined || val === null) continue;
    // 轉字串並移除過濾字符: "!'()*"
    const strVal = String(val).replace(/[!'()*]/g, '');
    const encodedKey = encodeURIComponent(key);
    const encodedVal = encodeURIComponent(strVal);
    queryParts.push(`${encodedKey}=${encodedVal}`);
  }

  const query = queryParts.join('&');
  const wbiSign = md5(query + mixinKey);

  return {
    ...newParams,
    w_rid: wbiSign
  };
}

/**
 * 純前端從 Bilibili 導航介面取得 img_key 與 sub_key
 */
export async function getWbiKeys(forceRefresh = false): Promise<{ img_key: string; sub_key: string }> {
  const now = Date.now();
  if (!forceRefresh && cachedWbiKeys && now - cachedWbiKeys.fetchedAt < WBI_KEY_CACHE_TTL) {
    return {
      img_key: cachedWbiKeys.img_key,
      sub_key: cachedWbiKeys.sub_key
    };
  }

  try {
    const json = await biliFetch<any>('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        Referer: 'https://www.bilibili.com/'
      }
    });

    const wbiImg = json?.data?.wbi_img;
    if (!wbiImg?.img_url || !wbiImg?.sub_url) {
      throw new Error('無法從 /x/web-interface/nav 解析 wbi_img');
    }

    const imgKey = extractKeyFromUrl(wbiImg.img_url);
    const subKey = extractKeyFromUrl(wbiImg.sub_url);

    cachedWbiKeys = {
      img_key: imgKey,
      sub_key: subKey,
      fetchedAt: now
    };

    try {
      localStorage.setItem(STORAGE_KEY_WBI, JSON.stringify(cachedWbiKeys));
    } catch {}

    return { img_key: imgKey, sub_key: subKey };
  } catch (err) {
    console.warn('[Standalone WBI] 獲取 WBI Key 失敗，啟用本機備用金鑰:', err);
    if (cachedWbiKeys) {
      return {
        img_key: cachedWbiKeys.img_key,
        sub_key: cachedWbiKeys.sub_key
      };
    }
    // 預設 Fallback (萬一離線或網路攔截)
    return {
      img_key: '653657877d884de39880fa9d88d28677',
      sub_key: '0970261b7f0e40dd830aab64c76b9f84'
    };
  }
}

function extractKeyFromUrl(url: string): string {
  const parts = url.split('/');
  const fileName = parts[parts.length - 1];
  return fileName.split('.')[0];
}

/**
 * 注入 WBI 簽名並轉成 URLSearchParams 字串
 */
export async function signWbiParams(params: Record<string, any>): Promise<string> {
  const { img_key, sub_key } = await getWbiKeys();
  const signed = encWbi(params, img_key, sub_key);
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(signed)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
}
