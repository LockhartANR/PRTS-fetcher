// Fetches the full operator list from the charId JS file

import { fetchWithRetry } from './fetcher.js';
import { PRTS } from './config.js';

/**
 * Fetches and parses the operator list from the wiki's charId JS file.
 * @returns {Promise<Array<{name: string, id: string, url: string}>>}
 */
export async function fetchOperatorList() {
  console.log('[1/4] Fetching operator list...');

  const { data } = await fetchWithRetry(PRTS.CHAR_ID_URL);
  const content = typeof data === 'string' ? data : data.toString();

  // Extract `var char_json = [...];` (dotAll mode so `.` matches newlines)
  const match = content.match(/var\s+char_json\s*=\s*(\[.*\]);?/s);
  if (!match) {
    throw new Error('Failed to parse operator list from charId.js — format may have changed');
  }

  const operators = JSON.parse(match[1]);

  const result = operators.map((op) => ({
    name: op.name,
    id: op.id,
    url: `${PRTS.WIKI_BASE}/w/${encodeURIComponent(op.name)}`,
  }));

  console.log(`  Found ${result.length} operators\n`);
  return result;
}
