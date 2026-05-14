/**
 * Reader-chosen hero gender for consistent narration (Claude) and art (Gemini).
 * @param {unknown} raw
 * @returns {'girl' | 'boy' | 'neutral'}
 */
export function parseHeroGender(raw) {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (s === 'girl' || s === 'boy' || s === 'neutral') return s
  return 'neutral'
}

/** One line for story prompts */
export function heroGenderNarrationRule(g) {
  if (g === 'girl') return 'The hero is a girl — use she/her consistently for the hero.'
  if (g === 'boy') return 'The hero is a boy — use he/him consistently for the hero.'
  return 'The hero is non-gendered for this run — use they/them consistently for the hero (or careful rewording if needed).'
}
