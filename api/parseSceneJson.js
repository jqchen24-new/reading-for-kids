/**
 * Normalize raw parsed JSON from the model into a validated scene object.
 * @param {unknown} parsed
 * @returns {{ narration: string, choices: string[], isEnding: boolean, illustrationCast?: Array<{ name: string, look: string }> }}
 */
export function normalizeParsedSceneObject(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid scene: root must be an object')
  }

  const p = /** @type {Record<string, unknown>} */ (parsed)

  if (typeof p.narration !== 'string' || !p.narration.trim()) {
    throw new Error('Invalid scene: narration')
  }

  const isEnding = Boolean(p.isEnding)

  let choices = []
  if (Array.isArray(p.choices)) {
    choices = p.choices
      .filter((c) => typeof c === 'string' && c.trim())
      .map((c) => c.trim())
  }

  const illustrationCast = normalizeIllustrationCast(p.illustrationCast)

  if (isEnding) {
    const base = { narration: p.narration.trim(), choices: [], isEnding: true }
    if (illustrationCast) {
      base.illustrationCast = illustrationCast
    }
    return base
  }

  if (choices.length !== 2) {
    throw new Error('Invalid scene: expected exactly 2 choices')
  }

  const base = {
    narration: p.narration.trim(),
    choices: [choices[0], choices[1]],
    isEnding: false,
  }
  if (illustrationCast) {
    base.illustrationCast = illustrationCast
  }
  return base
}

/**
 * Extract and validate scene JSON from model output (handles ```json fences).
 * @param {string} text
 * @returns {{ narration: string, choices: string[], isEnding: boolean, illustrationCast?: Array<{ name: string, look: string }> }}
 */
export function parseSceneFromModelText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty model response')
  }

  let t = text.trim()
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')

  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object in model response')
  }

  let parsed
  try {
    parsed = JSON.parse(t.slice(start, end + 1))
  } catch (parseErr) {
    const msg =
      parseErr instanceof Error ? parseErr.message : String(parseErr)
    const err = new Error(`Scene JSON was not valid: ${msg}`)
    err.code = 'PARSE_ERROR'
    throw err
  }

  try {
    return normalizeParsedSceneObject(parsed)
  } catch (normErr) {
    const err =
      normErr instanceof Error
        ? normErr
        : new Error(String(normErr))
    err.code = err.code || 'PARSE_ERROR'
    throw err
  }
}

/** @param {unknown} raw @returns {Array<{ name: string, look: string }> | undefined} */
function normalizeIllustrationCast(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  /** @type {Array<{ name: string, look: string }>} */
  const out = []
  const seen = new Set()
  for (const row of raw) {
    if (out.length >= 5) break
    if (!row || typeof row !== 'object') continue
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 40) : ''
    const look = typeof row.look === 'string' ? row.look.trim().slice(0, 500) : ''
    if (!name || !look) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, look })
  }
  return out.length > 0 ? out : undefined
}
