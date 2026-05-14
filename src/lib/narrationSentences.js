/**
 * Split narration text into sentence-sized spans with character offsets so the UI
 * can render each as its own <span> and highlight the active one during read-aloud.
 *
 * Each entry includes any trailing whitespace, so concatenating `text` for every
 * entry reproduces the original input (modulo never-matched empty input).
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
