/** Short-lived server memory: skip OpenAI TTS when billing/quota is exhausted. */

let openAiQuotaBlockedUntil = 0

export function isOpenAiQuotaBlocked() {
  return Date.now() < openAiQuotaBlockedUntil
}

/**
 * @param {number} [ms]
 */
export function markOpenAiQuotaBlocked(ms = 10 * 60 * 1000) {
  openAiQuotaBlockedUntil = Date.now() + ms
}

/**
 * @param {unknown} err
 */
export function isOpenAiInsufficientQuotaError(err) {
  if (!err || typeof err !== 'object') return false
  if (/** @type {{ code?: string }} */ (err).code === 'OPENAI_TTS_QUOTA') return true
  const msg = err instanceof Error ? err.message : String(err)
  return /insufficient_quota|exceeded your current quota/i.test(msg)
}

/**
 * @param {number} status
 * @param {string} rawText
 */
export function isGeminiQuotaResponse(status, rawText) {
  if (status !== 429) return false
  return /quota exceeded|RESOURCE_EXHAUSTED|GenerateRequestsPerMinute/i.test(rawText)
}
