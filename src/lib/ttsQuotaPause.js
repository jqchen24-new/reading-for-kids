/** Client-side: avoid hammering /api/tts when providers are out of quota. */

const KEY = 'rff-tts-quota-until'
const DEFAULT_MS = 5 * 60 * 1000

export function isNeuralTtsQuotaPaused() {
  if (typeof sessionStorage === 'undefined') return false
  try {
    const until = Number(sessionStorage.getItem(KEY))
    return Number.isFinite(until) && Date.now() < until
  } catch {
    return false
  }
}

/**
 * @param {number} [ms]
 */
export function markNeuralTtsQuotaPaused(ms = DEFAULT_MS) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(KEY, String(Date.now() + ms))
  } catch {
    /* ignore */
  }
}

export function clearNeuralTtsQuotaPause() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
