// PRTS.wiki Arknights operator data scraper — main entry point

import { fetchOperatorList } from './charListFetcher.js';
import { fetchMany } from './fetcher.js';
import { parseOperatorPage } from './pageParser.js';
import { transformOperators, writeOutput } from './outputWriter.js';
import { downloadAvatars } from './avatarDownloader.js';
import { RATE_LIMIT } from './config.js';

const USAGE = `
Usage: node src/index.js [options]

Options:
  --limit=N    Only scrape the first N operators (for testing)
  --avatars    Download avatar images to output/avatars/
  --help       Show this help message
`.trim();

/**
 * Parse CLI arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const limitArg = args.find(a => a.startsWith('--limit='));
  const avatars = args.includes('--avatars');
  if (limitArg) {
    const n = parseInt(limitArg.split('=')[1], 10);
    if (isNaN(n) || n <= 0) {
      console.error('Error: --limit must be a positive integer');
      process.exit(1);
    }
    return { limit: n, avatars };
  }
  return { limit: null, avatars };
}

async function main() {
  const startTime = Date.now();
  const { limit, avatars } = parseArgs();

  console.log('========================================');
  console.log('  PRTS.wiki Arknights Operator Scraper');
  console.log('========================================\n');

  try {
    // Step 1: Fetch operator list
    const allOperators = await fetchOperatorList();
    const operators = limit ? allOperators.slice(0, limit) : allOperators;

    if (limit) {
      console.log(`  [test mode] Only scraping the first ${limit} operators\n`);
    }

    // Step 2: Fetch operator pages concurrently
    console.log(`[2/4] Fetching ${operators.length} operator pages (concurrency=${RATE_LIMIT.CONCURRENCY})...`);

    const urls = operators.map(op => op.url);
    const pageResults = await fetchMany(urls, RATE_LIMIT.CONCURRENCY, (done, total) => {
      const pct = Math.round((done / total) * 100);
      process.stdout.write(`\r  Progress: ${done}/${total} (${pct}%)`);
    });
    console.log('');

    // Step 3: Parse each page
    console.log(`\n[3/4] Parsing operator data...`);

    const parsedResults = [];
    let parseSuccess = 0;
    let parseFailed = 0;

    for (const result of pageResults) {
      if (!result || !result.data) {
        parseFailed++;
        continue;
      }

      const { charInfo, avatarUrl } = parseOperatorPage(result.data);

      if (charInfo && charInfo.name) {
        parsedResults.push({ charInfo, avatarUrl, pageUrl: result.url });
        parseSuccess++;
      } else {
        parseFailed++;
        const name = decodeURIComponent(result.url.split('/w/').pop() || '');
        console.warn(`  [skip] ${name}: could not parse char_info`);
      }
    }

    console.log(`  Success: ${parseSuccess}, Failed: ${parseFailed}`);

    // Step 4: Transform and write output
    console.log(`\n[4/4] Generating output files...`);

    const { operators: outputOps, tagStats } = transformOperators(parsedResults);

    // Optional: download avatar images
    if (avatars) {
      console.log(`\n[avatars] Downloading ${outputOps.length} operator avatars (concurrency=${RATE_LIMIT.CONCURRENCY})...`);
      const { success, failed } = await downloadAvatars(outputOps, RATE_LIMIT.CONCURRENCY, (done, total) => {
        const pct = Math.round((done / total) * 100);
        process.stdout.write(`\r  Progress: ${done}/${total} (${pct}%)`);
      });
      console.log('');
      console.log(`  Downloaded: ${success}, Failed: ${failed}`);
    }

    writeOutput(outputOps, tagStats);

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n========================================');
    console.log('  Done!');
    console.log(`  Operators: ${outputOps.length}`);
    console.log(`  Elapsed: ${elapsed}s`);
    console.log('========================================');

  } catch (err) {
    console.error('\n[fatal error]', err.message);
    process.exit(1);
  }
}

main();
