/**
 * @param {string} t full narration
 * @param {number} i index of '.' '!' '?' or '…'
 */
function isRealSentenceEnd(t, i) {
  const c = t[i]
  if (c !== '.') return true
  if (i > 0 && i + 1 < t.length && /\d/.test(t[i - 1]) && /\d/.test(t[i + 1])) {
    return false
  }
  if (i + 1 < t.length && /[A-Za-z]/.test(t[i + 1])) {
    return false
  }
  let a = i - 1
  while (a >= 0 && /[A-Za-z'\u2019]/.test(t[a])) a--
  const word = t
    .slice(a + 1, i)
    .replace(/[''\u2019]/g, '')
    .toLowerCase()
  if (word && ABBREVIATION_BEFORE_PERIOD.has(word)) {
    return false
  }
  return true
}

/** Lowercase words where a trailing period is not end-of-sentence (e.g. Mrs. Smith). */
const ABBREVIATION_BEFORE_PERIOD = new Set([
  'mr',
  'mrs',
  'ms',
  'mss',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'st',
  'ave',
  'blvd',
  'mt',
  'ft',
  'approx',
  'vol',
  'ed',
  'rev',
  'gen',
  'col',
  'sen',
  'rep',
  'fig',
  'hon',
  'messrs',
  'mme',
  'mlle',
  'esq',
  'phd',
  'md',
  'bvm',
  'rsvp',
  'dept',
  'dist',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
])

/**
 * Split narration text into sentence-sized spans with character offsets so the UI
 * can render each as its own <span> and highlight the active one during read-aloud.
 *
 * Each entry includes any trailing whitespace, so concatenating `text` for every
 * entry reproduces the original input (modulo never-matched empty input).
 *
 * Periods after common abbreviations (Mrs., Dr., …) are not treated as sentence ends,
 * so highlighting does not break mid-sentence. "e.g." / "i.e." are handled by treating
 * a period followed immediately by a letter as non-terminal.
 *
 * @param {string} text
 * @returns {Array<{ text: string, start: number, end: number }>}
 */
export function splitNarrationSentences(text) {
  const t = typeof text === 'string' ? text : ''
  if (!t) return []

  /** @type {Array<{ text: string, start: number, end: number }>} */
  const out = []
  let start = 0

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '.' || c === '!' || c === '?' || c === '…') {
      if (c === '.' && !isRealSentenceEnd(t, i)) {
        continue
      }
      let j = i
      while (j + 1 < t.length && isSentenceTerminator(t[j + 1])) j++
      let k = j + 1
      while (k < t.length && /\s/.test(t[k])) k++
      out.push({ text: t.slice(start, k), start, end: k })
      i = k - 1
      start = k
    }
  }
  if (start < t.length) {
    out.push({ text: t.slice(start), start, end: t.length })
  }
  if (out.length === 0) {
    return [{ text: t, start: 0, end: t.length }]
  }
  return out
}

/** @param {string} ch */
function isSentenceTerminator(ch) {
  return ch === '.' || ch === '!' || ch === '?' || ch === '…'
}

/**
 * Find which sentence index covers a given character position (0-based offset into
 * the same string that was passed to {@link splitNarrationSentences}).
 *
 * @param {Array<{ start: number, end: number }>} sentences
 * @param {number} pos
 * @returns {number} index, or -1 if there are no sentences
 */
export function sentenceIndexForCharPosition(sentences, pos) {
  if (!sentences?.length) return -1
  const p = Math.max(0, Math.floor(pos))
  for (let i = 0; i < sentences.length; i++) {
    if (p < sentences[i].end) return i
  }
  return sentences.length - 1
}

/**
 * Map a playback ratio in [0, 1] to a sentence index using character lengths as weights.
 *
 * @param {Array<{ start: number, end: number }>} sentences
 * @param {number} ratio
 * @returns {number}
 */
export function sentenceIndexForRatio(sentences, ratio) {
  if (!sentences?.length || !Number.isFinite(ratio)) return -1
  const r = Math.max(0, Math.min(1, ratio))
  const total = sentences[sentences.length - 1].end
  if (total <= 0) return -1
  return sentenceIndexForCharPosition(sentences, Math.floor(r * total))
}
