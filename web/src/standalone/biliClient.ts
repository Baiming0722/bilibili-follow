/**
 * 純前端 / 手機端 Bilibili 網路請求客戶端
 *
 * 核心原理：
 * 在 Android Capacitor 原生應用中，藉由 CapacitorHttp 外掛程式，
 * 請求由 Android 底層原生 HttpURLConnection 發起，完全無視瀏覽器同源政策 (CORS)！
 * 且可自由攜帶 Referer: https://www.bilibili.com/ 與自訂 User-Agent。
 *
 * 在純 PC 瀏覽器環境下，若以獨立模式運行，則嘗試 fetch 直連或降級提示。
 */

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

export function isCapacitorNative(): boolean {
  return typeof (window as any).Capacitor !== 'undefined' &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform();
}

export interface BiliFetchOptions {
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: any;
  ttlMs?: number;
}

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/'
};

/**
 * 智慧發送請求至 Bilibili API
 */
export async function biliFetch<T = any>(url: string, options: BiliFetchOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const ttlMs = options.ttlMs || 0;

  // 1. 快取檢查 (僅針對 GET)
  if (method === 'GET' && ttlMs > 0) {
    const cached = memoryCache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }
  }

  const mergedHeaders: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...options.headers
  };

  let responseData: any;

  // 2. 檢測是否具備 Capacitor 原生 Http 外掛能力
  const cap = (window as any).Capacitor;
  const hasCapacitorHttp = isCapacitorNative() || (cap?.Plugins?.CapacitorHttp);

  if (hasCapacitorHttp && cap?.Plugins?.CapacitorHttp?.request) {
    try {
      const res = await cap.Plugins.CapacitorHttp.request({
        url,
        method,
        headers: mergedHeaders,
        data: options.body
      });
      responseData = res.data;
    } catch (capErr: any) {
      console.warn('[Standalone biliFetch] CapacitorHttp 失敗，嘗試標準 fetch:', capErr);
      responseData = await fallbackBrowserFetch(url, method, mergedHeaders, options.body);
    }
  } else {
    // 瀏覽器環境下的標準 fetch
    responseData = await fallbackBrowserFetch(url, method, mergedHeaders, options.body);
  }

  // 3. 寫入快取
  if (method === 'GET' && ttlMs > 0 && responseData) {
    memoryCache.set(url, {
      data: responseData,
      expiresAt: Date.now() + ttlMs
    });
  }

  return responseData as T;
}

async function fallbackBrowserFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: any
): Promise<any> {
  const fetchInit: RequestInit = {
    method,
    headers,
    credentials: 'omit'
  };

  if (body) {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!fetchInit.headers) {
      fetchInit.headers = {};
    }
    if (!(fetchInit.headers as Record<string, string>)['Content-Type']) {
      (fetchInit.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, fetchInit);
  if (!res.ok) {
    throw new Error(`HTTP 請求失敗 (${res.status} ${res.statusText})`);
  }
  return await res.json();
}
