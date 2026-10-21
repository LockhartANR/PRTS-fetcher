// HTTP client — wraps axios with rate limiting, retry, and exponential backoff

import axios from 'axios';
import { RATE_LIMIT } from './config.js';

let lastRequestTime = 0;

// ---------------------------------------------------------------------------
// Cookie 罐 —— 应对 wiki 的「先发 cookie 再刷新」挑战
//
// 2026-10 起，prts.wiki 及其 static/media 子域会对请求先返回一个约 57 字节的
// 挑战页，同时下发 `sec=...` cookie：
//
//     <html><script>document.location.reload();</script></html>
//
// 带上该 cookie 重新请求才能拿到真实内容。axios 不会自动保存 cookie，
// 因此这里自己维护。按 host 分开存 —— 实测 Set-Cookie 不带 Domain 属性，
// 属于 host-only，不能跨子域共用。
// ---------------------------------------------------------------------------
const cookieJars = new Map();

function jarFor(host) {
  if (!cookieJars.has(host)) cookieJars.set(host, new Map());
  return cookieJars.get(host);
}

function cookieHeader(host) {
  const jar = jarFor(host);
  if (jar.size === 0) return undefined;
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbCookies(host, setCookie) {
  if (!setCookie) return;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  const jar = jarFor(host);
  for (const raw of list) {
    const pair = String(raw).split(';')[0];
    const eq = pair.indexOf('=');
    if (eq > 0) {
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
}

/** 挑战页的特征：很短、且内容是「刷新页面」。 */
function isChallengePage(data) {
  if (typeof data !== 'string') return false;
  return data.length < 400 && /document\.location\.reload/.test(data);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT.DELAY_MS) {
    await delay(RATE_LIMIT.DELAY_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

/**
 * 发一次请求，处理 cookie 与挑战页。
 * 挑战页不算失败 —— 拿到 cookie 后立刻重试，最多 CHALLENGE_RETRIES 次。
 */
const CHALLENGE_RETRIES = 3;

async function requestOnce(url, options) {
  const host = new URL(url).host;

  for (let i = 0; i <= CHALLENGE_RETRIES; i++) {
    await rateLimitWait();

    const headers = {
      'User-Agent': 'prts-fetcher/1.0 (arknights data scraper)',
      'Accept': 'text/html,application/json,*/*',
      ...options.headers,
    };
    const cookie = cookieHeader(host);
    if (cookie) headers['Cookie'] = cookie;

    const response = await axios.get(url, {
      timeout: RATE_LIMIT.TIMEOUT_MS,
      responseType: options.responseType || 'text',
      ...options,
      headers,
      // 挑战页是 200，不需要特殊处理状态码
    });

    absorbCookies(host, response.headers && response.headers['set-cookie']);

    if (isChallengePage(response.data) && i < CHALLENGE_RETRIES) {
      // 已吸收到 cookie，下一轮会带上；短暂等待避免连打
      await delay(300);
      continue;
    }

    return { data: response.data, status: response.status };
  }

  // 理论上不会到这里，兜底当作失败
  throw new Error(`challenge page not resolved after ${CHALLENGE_RETRIES} retries: ${url}`);
}

/**
 * HTTP GET with retry and rate limiting.
 * Retries on network errors, 429s, and 5xx responses with exponential backoff.
 */
export async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= RATE_LIMIT.RETRIES; attempt++) {
    try {
      return await requestOnce(url, options);
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        (err.response && err.response.status >= 500) ||
        (err.response && err.response.status === 429);

      if (attempt < RATE_LIMIT.RETRIES && isRetryable) {
        const waitMs = RATE_LIMIT.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`  [retry] ${url} (attempt ${attempt} failed, retrying in ${waitMs}ms)`);
        await delay(waitMs);
      } else {
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Fetch multiple URLs concurrently with a progress callback.
 * Failed fetches return `{ url, data: null, error }` instead of throwing.
 */
export async function fetchMany(urls, concurrency, onProgress) {
  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(concurrency);

  let completed = 0;
  const total = urls.length;

  const tasks = urls.map((url) =>
    limit(async () => {
      try {
        const result = await fetchWithRetry(url);
        completed++;
        if (onProgress) onProgress(completed, total);
        return { url, data: result.data, status: result.status };
      } catch (err) {
        completed++;
        if (onProgress) onProgress(completed, total, err);
        console.error(`  [failed] ${url}: ${err.message}`);
        return { url, data: null, error: err.message };
      }
    })
  );

  return Promise.all(tasks);
}
