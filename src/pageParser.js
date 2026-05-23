// Extracts char_info JSON and avatar URL from operator wiki page HTML

import crypto from 'crypto';
import * as cheerio from 'cheerio';

/**
 * Cleans a JavaScript object literal so it can be parsed as valid JSON.
 * - Removes trailing commas before } and ]
 * - Unescapes single quotes (JSON does not need them escaped)
 */
function sanitizeToJson(jsLiteral) {
  let result = jsLiteral.replace(/,(\s*[}\]])/g, '$1');
  result = result.replace(/\\'/g, "'");
  return result;
}

/**
 * Extracts the `var char_info = {...}` JSON block from wiki page HTML.
 * Uses two strategies:
 *   1. Regex match (fast path)
 *   2. Brace-counting parser (fallback for incomplete regex captures)
 */
export function extractCharInfo(html) {
  // Method 1: regex match for `var char_info = {...};`
  const match = html.match(/var\s+char_info\s*=\s*(\{[\s\S]*?\});(?=\s*(?:\n|var|window|function|if|else|const|let))/);
  if (match) {
    try {
      return JSON.parse(sanitizeToJson(match[1]));
    } catch {
      // regex capture may be incomplete, fall through to method 2
    }
  }

  // Method 2: find `var char_info=`, then brace-count to locate the full JSON object
  const startIdx = html.indexOf('var char_info');
  if (startIdx === -1) return null;

  const braceStart = html.indexOf('{', startIdx);
  if (braceStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonStr = html.substring(braceStart, i + 1);
        try {
          return JSON.parse(sanitizeToJson(jsonStr));
        } catch (e) {
          console.error(`  [parse error] JSON parse failed: ${e.message}`);
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Computes the operator avatar URL using MediaWiki's standard MD5 filename hashing.
 * The filename is "头像_{name}.png" and the URL path is derived from the MD5 hex digest.
 */
export function computeAvatarUrl(name) {
  const filename = `头像_${name}.png`;
  const hash = crypto.createHash('md5').update(filename).digest('hex');
  return `https://media.prts.wiki/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(filename)}`;
}

/**
 * Fallback: extract avatar URL from the img#charicon element in the HTML.
 */
function extractAvatarFromHtml(html) {
  const $ = cheerio.load(html);
  const img = $('#charicon');
  if (img.length > 0) {
    return img.attr('src') || null;
  }
  return null;
}

/**
 * Parses a single operator wiki page.
 * Returns the extracted char_info object and the computed avatar URL.
 */
export function parseOperatorPage(html) {
  const charInfo = extractCharInfo(html);

  let avatarUrl = null;

  if (charInfo && charInfo.name) {
    // Primary method: compute avatar URL via MD5 hash
    avatarUrl = computeAvatarUrl(charInfo.name);
  }

  // Fallback: extract from HTML
  if (!avatarUrl) {
    avatarUrl = extractAvatarFromHtml(html);
  }

  return { charInfo, avatarUrl };
}
