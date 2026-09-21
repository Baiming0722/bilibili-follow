import crypto from 'node:crypto';
import { getBiliCookies } from './client.js';

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

let cachedWbiKeys: WbiKeys | null = null;
const WBI_KEY_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 小時快取

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
 * 計算 MD5 雜湊
 */
function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * 對參數執行 WBI 簽名計算
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
    let val = newParams[key];
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
 * 從 Bilibili 導航介面動態提取 img_key 與 sub_key
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
    const cookies = await getBiliCookies();
    const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
        Cookie: cookies
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const json = (await res.json()) as any;
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

    return { img_key: imgKey, sub_key: subKey };
  } catch (err) {
    console.error('[WBI] 獲取 WBI Key 失敗:', err);
    // 若曾有快取即使過期也先備用
    if (cachedWbiKeys) {
      return {
        img_key: cachedWbiKeys.img_key,
        sub_key: cachedWbiKeys.sub_key
      };
    }
    // 預設 Fallback (萬一遭遇網路阻斷)
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
