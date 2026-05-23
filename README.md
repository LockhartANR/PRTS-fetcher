# PRTS Fetcher

> Scrape Arknights operator data from [PRTS.wiki](https://prts.wiki) — 从 PRTS.wiki 爬取明日方舟干员数据

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

PRTS Fetcher scrapes the [PRTS.wiki](https://prts.wiki) (the community-maintained Arknights wiki) to collect structured data for all operators, including:

- **Name** (Chinese and English)
- **Rarity** (1–6 stars)
- **Class** and **Branch** (subclass)
- **Position** (melee / ranged)
- **Recruitment tags** (class, position, and affix tags)
- **Avatar image URL**
- **Artist** (painter/illustrator)
- **Faction / Group**

Output is written as clean JSON files ready for downstream use.

---

## Installation

```bash
git clone https://github.com/<your-org>/prts-fetcher.git
cd prts-fetcher
npm install
```

**Requirements:** Node.js >= 18

## Usage

```bash
# Scrape all operators
npm start

# Test run (first 10 operators only)
npm test

# With a custom limit
node src/index.js --limit=100

# Show help
node src/index.js --help
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CHAR_ID_URL` | *(auto)* | Override the charId JS file URL (useful when the wiki updates its data snapshot) |

## Output

After a successful run, two files are written to `output/`:

### `output/operators.json`

```json
[
  {
    "id": "amiya",
    "name": "阿米娅",
    "nameEn": "Amiya",
    "rarity": 5,
    "class": "术师",
    "branch": "中坚术师",
    "position": "远程位",
    "tags": ["远程位", "术师", "输出"],
    "avatar": "https://media.prts.wiki/...",
    "groupId": "罗德岛",
    "painter": "唯@W"
  }
]
```

### `output/tags.json`

```json
[
  { "tag": "输出", "count": 229 },
  { "tag": "近战位", "count": 216 }
]
```

## How It Works

1. **Fetch operator list** — Parses the wiki's `charId.js` metadata file to get all operator names and IDs.
2. **Fetch pages** — Concurrently fetches each operator's wiki page (configurable concurrency, rate-limited).
3. **Parse pages** — Extracts the `char_info` JSON blob embedded in each page's JavaScript, plus computes avatar URLs via MediaWiki's MD5 filename hashing.
4. **Transform & output** — Standardizes the data, resolves duplicate IDs, computes tag statistics, and writes JSON output.

## Configuration

Rate limits, retry behavior, and output paths are configured in [`src/config.js`](src/config.js):

| Setting | Default | Description |
|---|---|---|
| `CONCURRENCY` | 3 | Max parallel requests |
| `DELAY_MS` | 200 | Delay between requests |
| `RETRIES` | 3 | Max retry attempts on failure |
| `RETRY_DELAY_MS` | 2000 | Initial backoff (exponential) |
| `TIMEOUT_MS` | 15000 | Per-request timeout |

## Disclaimer

This tool scrapes publicly available data from PRTS.wiki for informational purposes. Please:

- Respect the wiki's rate limits and server resources (adjust `CONCURRENCY` and `DELAY_MS` if needed).
- Do not use this tool for excessive or aggressive scraping.
- The data belongs to PRTS.wiki and its contributors. Attribute accordingly.

PRTS Fetcher is **not** affiliated with PRTS.wiki, Hypergryph, or Yostar.

## License

[MIT](LICENSE)
