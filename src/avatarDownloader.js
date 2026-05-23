// Downloads operator avatar images from PRTS media server

import fs from 'fs';
import path from 'path';
import { fetchWithRetry } from './fetcher.js';

const AVATAR_DIR = './output/avatars';

/**
 * Downloads avatar images for all operators with valid avatar URLs.
 * Images are saved as `output/avatars/{id}.png` using each operator's
 * final resolved ID as the filename.
 *
 * @param {Array<{id: string, avatar: string}>} operators
 * @param {number} concurrency
 * @param {Function} onProgress - (completed, total) callback
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function downloadAvatars(operators, concurrency, onProgress) {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }

  const toDownload = operators.filter(op => op.avatar);

  const pLimit = (await import('p-limit')).default;
  const limit = pLimit(concurrency);

  let completed = 0;
  let success = 0;
  let failed = 0;
  const total = toDownload.length;

  const tasks = toDownload.map((op) =>
    limit(async () => {
      try {
        const { data } = await fetchWithRetry(op.avatar, {
          responseType: 'arraybuffer',
        });

        const urlPath = new URL(op.avatar).pathname;
        const ext = path.extname(urlPath) || '.png';
        // Sanitize ID for filesystem safety (strip path separators)
        const safeId = op.id.replace(/[\/\\]/g, '-');
        const filepath = path.join(AVATAR_DIR, `${safeId}${ext}`);
        fs.writeFileSync(filepath, Buffer.from(data));

        success++;
      } catch (err) {
        failed++;
        console.error(`  [avatar failed] ${op.id}: ${err.message}`);
      }
      completed++;
      if (onProgress) onProgress(completed, total);
    })
  );

  await Promise.all(tasks);

  return { success, failed };
}
