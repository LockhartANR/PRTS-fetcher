// HTTP client — wraps axios with rate limiting, retry, and exponential backoff

import axios from 'axios';
import { RATE_LIMIT } from './config.js';

let lastRequestTime = 0;

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
 * HTTP GET with retry and rate limiting.
 * Retries on network errors, 429s, and 5xx responses with exponential backoff.
 */
export async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 1; attempt <= RATE_LIMIT.RETRIES; attempt++) {
    try {
      await rateLimitWait();

      const response = await axios.get(url, {
        timeout: RATE_LIMIT.TIMEOUT_MS,
        headers: {
          'User-Agent': 'prts-fetcher/1.0 (arknights data scraper)',
          'Accept': 'text/html,application/json,*/*',
          ...options.headers,
        },
        responseType: options.responseType || 'text',
        ...options,
      });

      return { data: response.data, status: response.status };
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
