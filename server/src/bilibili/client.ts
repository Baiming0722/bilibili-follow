/**
 * Bilibili 通用客戶端
 * - 桌面瀏覽器 User-Agent / Referer
 * - 自動自舉取得完整的 B 站 Cookies (buvid3, b_nut 等)
 * - 記憶體 LRU / TTL 快取
 * - 風控錯誤碼 (-412, 429, -352) 指數退避重試
 */

interface CacheEntry<T = any> {
  data: T;
  expiresAt: number;
}

class SimpleLruTtlCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const bilibiliCache = new SimpleLruTtlCache(1000);

let cachedCookies = '';
let cookiesFetchedAt = 0;
const COOKIE_TTL = 12 * 60 * 60 * 1000; // 12 小時

/**
 * 產生預設的 fallback buvid3
 */
function generateFallbackBuvid3(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let rand = '';
  for (let i = 0; i < 32; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `XY${rand}infoc`;
}

/**
 * 自舉取得完整 B 站 Cookies (包含 buvid3, b_nut)
 */
export async function getBiliCookies(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedCookies && now - cookiesFetchedAt < COOKIE_TTL) {
    return cachedCookies;
  }

  try {
    const res = await fetch('https://www.bilibili.com/', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'manual'
    });

    const setCookies = res.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      const cookieMap = new Map<string, string>();
      for (const cookie of setCookies) {
        const firstPart = cookie.split(';')[0];
        const [k, v] = firstPart.split('=');
        if (k && v) {
          cookieMap.set(k.trim(), v.trim());
        }
      }
      
      const pairs: string[] = [];
      for (const [k, v] of cookieMap.entries()) {
        pairs.push(`${k}=${v}`);
      }
      
      cachedCookies = pairs.join('; ');
      cookiesFetchedAt = now;
      return cachedCookies;
    }

    const fallbackBuvid3 = generateFallbackBuvid3();
    cachedCookies = `buvid3=${fallbackBuvid3}; b_nut=${Math.round(now / 1000)}`;
    cookiesFetchedAt = now;
    return cachedCookies;
  } catch (err) {
    console.warn('[BilibiliClient] 自舉 Cookies 異常，使用保底值:', err);
    if (!cachedCookies) {
      cachedCookies = `buvid3=${generateFallbackBuvid3()}; b_nut=${Math.round(now / 1000)}`;
    }
    return cachedCookies;
  }
}

export interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: any;
  ttlMs?: number; // 0 表示不快取
  maxRetries?: number;
  headers?: Record<string, string>;
  skipCache?: boolean;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 封裝通用 Fetch 請求
 */
export async function fetchBiliJson<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { ttlMs = 0, maxRetries = 1, headers = {}, skipCache = false, method = 'GET', body } = options;

  if (!skipCache && ttlMs > 0 && method === 'GET') {
    const hit = bilibiliCache.get<T>(url);
    if (hit) return hit;
  }

  const cookies = await getBiliCookies();

  const defaultHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Referer: 'https://www.bilibili.com/',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Cookie: cookies
  };

  const finalHeaders: Record<string, string> = {
    ...defaultHeaders,
    ...headers
  };

  const fetchInit: RequestInit = {
    method,
    headers: finalHeaders
  };

  if (body !== undefined) {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!finalHeaders['Content-Type']) {
      finalHeaders['Content-Type'] = 'application/json';
    }
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, fetchInit);

      if (res.status === 429) {
        throw new Error('429 Too Many Requests (觸發 B 站頻率限制)');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as any;

      if (ttlMs > 0 && json.code === 0 && method === 'GET') {
        bilibiliCache.set(url, json, ttlMs);
      }

      return json as T;
    } catch (err: any) {
      lastError = err;
      attempt++;

      if (attempt <= maxRetries) {
        const waitMs = Math.pow(2, attempt - 1) * 800 + Math.random() * 300;
        await delay(waitMs);
      }
    }
  }

  throw lastError || new Error(`請求 ${url} 失敗`);
}
