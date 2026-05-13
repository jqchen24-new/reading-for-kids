/**
 * Extract and validate scene JSON from model output (handles ```json fences).
 * @param {string} text
 * @returns {{ narration: string, choices: string[], isEnding: boolean }}
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

  if (typeof parsed.narration !== 'string' || !parsed.narration.trim()) {
    throw new Error('Invalid scene: narration')
  }

  const isEnding = Boolean(parsed.isEnding)

  let choices = []
  if (Array.isArray(parsed.choices)) {
    choices = parsed.choices
      .filter((c) => typeof c === 'string' && c.trim())
      .map((c) => c.trim())
  }

  if (isEnding) {
    return { narration: parsed.narration.trim(), choices: [], isEnding: true }
  }

  if (choices.length !== 2) {
    throw new Error('Invalid scene: expected exactly 2 choices')
  }

  return {
    narration: parsed.narration.trim(),
    choices: [choices[0], choices[1]],
    isEnding: false,
  }
}
