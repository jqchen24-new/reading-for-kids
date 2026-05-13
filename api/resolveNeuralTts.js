import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'

/**
 * Pick which server-side neural TTS backend to use.
 * @returns {{ ok: true, provider: 'openai' | 'gemini' } | { ok: false, code: string }}
 */
export function resolveNeuralTtsProvider() {
  const explicit = process.env.TTS_PROVIDER?.trim().toLowerCase()
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim())
  const hasGemini = Boolean(readGeminiApiKeyFromEnv())

  if (explicit === 'openai') {
    if (!hasOpenai) return { ok: false, code: 'MISSING_OPENAI_KEY' }
    return { ok: true, provider: 'openai' }
  }
  if (explicit === 'gemini') {
    if (!hasGemini) return { ok: false, code: 'MISSING_GEMINI_KEY' }
    return { ok: true, provider: 'gemini' }
  }

  if (explicit && explicit !== 'auto') {
    return { ok: false, code: 'INVALID_TTS_PROVIDER' }
  }

  if (hasOpenai) return { ok: true, provider: 'openai' }
  if (hasGemini) return { ok: true, provider: 'gemini' }
  return { ok: false, code: 'MISSING_NEURAL_TTS' }
}
