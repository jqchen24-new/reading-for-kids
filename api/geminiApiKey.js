/**
 * API key for generativelanguage.googleapis.com (AI Studio / Gemini API).
 * Accepts names used across Google samples and docs.
 */
export function readGeminiApiKeyFromEnv() {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
  ]
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const t = c.trim().replace(/^['"]+|['"]+$/g, '')
    if (t) return t
  }
  return ''
}
