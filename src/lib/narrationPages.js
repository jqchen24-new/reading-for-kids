/** Default max characters per on-screen / read-aloud "page" (one TTS chunk). */
const DEFAULT_MAX_CHARS = 520

/** Merge a trailing very short page into the previous one when possible. */
const MERGE_IF_UNDER = 56

/**
 * Split story narration into shorter pages for reading and neural TTS (smaller chunks sound more natural).
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string[]} non-empty strings; at least one entry
 */
export function splitNarrationIntoPages(text, maxChars = DEFAULT_MAX_CHARS) {
  const cap = Math.max(280, Math.min(900, maxChars))
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return ['']

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  /** @type {string[]} */
  const sentences = []
  for (const p of paragraphs) {
    sentences.push(...extractSentences(p))
  }
  if (sentences.length === 0) return [trimmed]

  /** @type {string[]} */
  const packed = []
  let cur = ''

  const flush = () => {
    if (cur) {
      packed.push(cur)
      cur = ''
    }
  }

  for (const sent of sentences) {
    if (!sent) continue
    if (sent.length > cap) {
      flush()
      packed.push(...chunkOversizedText(sent, cap))
      continue
    }
    const joined = cur ? `${cur} ${sent}` : sent
    if (joined.length <= cap) {
      cur = joined
    } else {
      flush()
      cur = sent
    }
  }
  flush()

  while (packed.length >= 2 && packed[packed.length - 1].length < MERGE_IF_UNDER) {
    const last = /** @type {string} */ (packed.pop())
    packed[packed.length - 1] = `${packed[packed.length - 1]} ${last}`.trim()
  }

  return packed.length > 0 ? packed : [trimmed]
}

/** @param {string} paragraph single paragraph, normalized spaces */
function extractSentences(paragraph) {
  const s = paragraph.trim()
  if (!s) return []
  const parts = s.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [s]
}

/** @param {string} text */
function chunkOversizedText(text, cap) {
  const words = text.split(/\s+/).filter(Boolean)
  /** @type {string[]} */
  const out = []
  let cur = ''
  for (const w of words) {
    const piece = w.length > cap ? w.match(new RegExp(`.{1,${cap}}`, 'g')) || [w] : [w]
    for (const fragment of piece) {
      const next = cur ? `${cur} ${fragment}` : fragment
      if (next.length <= cap) {
        cur = next
      } else {
        if (cur) out.push(cur)
        cur = fragment
      }
    }
  }
  if (cur) out.push(cur)
  return out.length > 0 ? out : [text.slice(0, cap)]
}
