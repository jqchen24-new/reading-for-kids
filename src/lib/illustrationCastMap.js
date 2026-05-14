/**
 * Merge model-provided illustrationCast rows into a stable map (first look wins).
 * @param {Record<string, string>} map
 * @param {unknown} scene
 * @param {string} heroKey lowercased hero name to exclude from supporting cast
 * @returns {Record<string, string>}
 */
export function mergeIllustrationCastFromScene(map, scene, heroKey) {
  const out = { ...map }
  const arr = scene?.illustrationCast
  if (!Array.isArray(arr)) return out
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 40) : ''
    const look = typeof row.look === 'string' ? row.look.trim().slice(0, 400) : ''
    if (!name || !look) continue
    const key = name.toLowerCase()
    if (key === heroKey) continue
    if (!out[key]) out[key] = look
  }
  return out
}

/**
 * @param {Array<{ scene?: unknown }>} pages
 * @param {string} heroKey
 */
export function aggregateCastFromPages(pages, heroKey) {
  let m = {}
  for (const p of pages) {
    m = mergeIllustrationCastFromScene(m, p.scene, heroKey)
  }
  return m
}

/**
 * @param {Record<string, string>} map
 * @param {string} heroKey
 * @param {number} [maxChars]
 */
export function formatEstablishedCastForPrompt(map, heroKey, maxChars = 2400) {
  const entries = Object.entries(map).filter(([k]) => k && k !== heroKey)
  entries.sort(([a], [b]) => a.localeCompare(b))
  const lines = entries.map(([k, v]) => `- ${k}: ${v}`)
  let text = lines.join('\n')
  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n… (truncated)'
  }
  return text
}
