// Data transformation and JSON output

import fs from 'fs';
import path from 'path';
import { STAR_OFFSET, RECRUIT_TAGS, OUTPUT } from './config.js';
import { resolveTags } from './tagResolver.js';

/**
 * Transforms raw parsed results into standardized operator records.
 * Handles duplicate IDs by appending the class name as a suffix.
 * Also builds per-tag occurrence counts.
 */
export function transformOperators(parsedResults) {
  const operators = [];
  const tagCounts = new Map();

  for (const result of parsedResults) {
    if (!result || !result.charInfo) continue;

    const ci = result.charInfo;
    if (!ci.name) continue;

    let id = ci.nameEn ? ci.nameEn.toLowerCase().replace(/["'\s]/g, '') : ci.name;
    const rarity = (ci.star ?? -1) + STAR_OFFSET;
    const tags = resolveTags(ci);

    const operator = {
      id,
      name: ci.name,
      nameEn: ci.nameEn || '',
      rarity,
      class: ci.class || '',
      branch: ci.branch || '',
      position: ci.pos || '',
      tags,
      avatar: result.avatarUrl || '',
      groupId: ci.group || '',
      painter: ci.painter || '',
    };

    operators.push(operator);

    for (const tag of tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  // Sort by ID
  operators.sort((a, b) => a.id.localeCompare(b.id));

  // Resolve duplicate IDs by appending the class name
  const seenIds = new Map();
  for (const op of operators) {
    if (seenIds.has(op.id)) {
      const count = seenIds.get(op.id) + 1;
      seenIds.set(op.id, count);
      op.id = `${op.id}-${op.class}`;
    } else {
      seenIds.set(op.id, 1);
    }
  }

  // Re-sort after ID changes
  operators.sort((a, b) => a.id.localeCompare(b.id));

  // Build tag statistics sorted by count
  const tagStats = [];
  for (const tag of RECRUIT_TAGS) {
    tagStats.push({ tag, count: tagCounts.get(tag) || 0 });
  }
  // Include position and class tags in stats
  for (const tag of ['远程位', '近战位', '先锋', '近卫', '狙击', '重装', '医疗', '辅助', '术师', '特种']) {
    if (!tagStats.find(t => t.tag === tag)) {
      tagStats.push({ tag, count: tagCounts.get(tag) || 0 });
    }
  }
  tagStats.sort((a, b) => b.count - a.count);

  return { operators, tagStats };
}

/**
 * Writes operators.json and tags.json to the output directory.
 * Creates the output directory if it does not exist.
 */
export function writeOutput(operators, tagStats) {
  const outputDir = path.dirname(OUTPUT.OPERATORS);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT.OPERATORS, JSON.stringify(operators, null, 2), 'utf-8');
  console.log(`\n[output] ${operators.length} operators → ${OUTPUT.OPERATORS}`);

  fs.writeFileSync(OUTPUT.TAGS, JSON.stringify(tagStats, null, 2), 'utf-8');
  console.log(`[output] ${tagStats.length} tag entries → ${OUTPUT.TAGS}`);
}
