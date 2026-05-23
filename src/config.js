// Scraper configuration

// The charId JS file URL — the filename includes a date stamp that changes
// when the wiki publishes updated character metadata.
// Override with the CHAR_ID_URL environment variable if needed.
export const PRTS = {
  CHAR_ID_URL: process.env.CHAR_ID_URL || 'https://static.prts.wiki/charinfo/charId20260110.js',
  WIKI_BASE: 'https://prts.wiki',
  MEDIA_BASE: 'https://media.prts.wiki',
};

// Known recruitment affix tags (used for tag statistics)
export const RECRUIT_TAGS = [
  '输出', '治疗', '支援', '群攻', '减速',
  '生存', '防护', '削弱', '位移', '爆发',
  '召唤', '快速复活', '费用回复', '新手', '控场',
  '支援机械', '元素',
];

// The star field in char_info is 0-indexed; actual rarity = star + 1
export const STAR_OFFSET = 1;

// Rate limiting and retry configuration
export const RATE_LIMIT = {
  CONCURRENCY: 3,          // Max concurrent requests
  DELAY_MS: 200,           // Delay between requests (ms)
  RETRIES: 3,              // Max retry attempts
  RETRY_DELAY_MS: 2000,    // Initial retry backoff (ms)
  TIMEOUT_MS: 15000,       // Request timeout (ms)
};

// Output file paths
export const OUTPUT = {
  OPERATORS: './output/operators.json',
  TAGS: './output/tags.json',
};
