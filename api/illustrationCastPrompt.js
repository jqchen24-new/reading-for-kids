/**
 * Server-side helpers for illustration cast continuity (story + image APIs).
 */

/**
 * @param {unknown} raw from JSON body.establishedIllustrationCast
 * @returns {Record<string, string>}
 */
export function parseEstablishedIllustrationCast(raw) {
  /** @type {Record<string, string>} */
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  let n = 0
  for (const [k0, v0] of Object.entries(raw)) {
    if (n >= 16) break
    const k = typeof k0 === 'string' ? k0.trim().slice(0, 40).toLowerCase() : ''
    const v = typeof v0 === 'string' ? v0.trim().slice(0, 380) : ''
    if (!k || !v) continue
    if (!out[k]) out[k] = v
    n++
  }
  return out
}

/**
 * @param {Record<string, string>} map
 * @param {string} heroLower
 * @param {number} [maxChars]
 */
export function formatEstablishedSupportingCast(map, heroLower, maxChars = 2400) {
  const entries = Object.entries(map).filter(([k]) => k && k !== heroLower)
  entries.sort(([a], [b]) => a.localeCompare(b))
  const lines = entries.map(([k, v]) => `- ${k}: ${v}`)
  let text = lines.join('\n')
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n… (truncated)'
  }
  return text
}
