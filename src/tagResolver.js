// Recruitment tag resolution for Arknights operators

import { RECRUIT_TAGS } from './config.js';

/**
 * Builds the complete recruitment tag list for an operator from char_info.
 *
 * Tag categories:
 *   Position  — from char_info.pos  (e.g. "远程位" / "近战位")
 *   Class     — from char_info.class (e.g. "先锋", "近卫", etc.)
 *   Affix     — from char_info.tag, space-separated (e.g. "输出 生存")
 */
export function resolveTags(charInfo) {
  const tags = [];

  // Position tag
  if (charInfo.pos) {
    tags.push(charInfo.pos);
  }

  // Class tag
  if (charInfo.class) {
    tags.push(charInfo.class);
  }

  // Affix tags (may be space-separated)
  if (charInfo.tag) {
    const affixTags = charInfo.tag.split(/\s+/).filter(Boolean);
    tags.push(...affixTags);
  }

  return tags;
}

/**
 * Validates tags against the known tag pool.
 * Returns { valid, unknown } so callers can detect new or changed tags.
 */
export function validateTags(tags) {
  const positionTags = ['远程位', '近战位'];
  const classTags = ['先锋', '近卫', '狙击', '重装', '医疗', '辅助', '术师', '特种'];
  const allKnown = [...positionTags, ...classTags, ...RECRUIT_TAGS];

  const valid = tags.filter(t => allKnown.includes(t));
  const unknown = tags.filter(t => !allKnown.includes(t));

  return { valid, unknown };
}
