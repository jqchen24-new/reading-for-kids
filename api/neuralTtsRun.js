import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'
import { synthesizeSpeechToWav } from './geminiTts.js'
import { synthesizeSpeechToMp3 } from './openaiTts.js'
import { resolveNeuralTtsProvider } from './resolveNeuralTts.js'

function ttsProviderIsAutoOrUnset() {
  const p = process.env.TTS_PROVIDER?.trim().toLowerCase()
  return !p || p === 'auto'
}

/** When TTS_PROVIDER=gemini, allow OpenAI on any Gemini failure (not only 429). */
function openAiFallbackOnAnyGeminiErrorEnabled() {
  const v = process.env.TTS_FALLBACK_ON_ERROR?.trim().toLowerCase()
  if (!v) return false
  return (
    v === 'openai' ||
    v === '1' ||
    v === 'true' ||
    v === 'yes' ||
    v === 'on'
  )
}

/**
 * @template T
 * @param {number} ms
 * @param {Promise<T>} promise
 * @returns {Promise<T>}
 */
async function withTimeout(ms, promise) {
  let timer
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => {
      const err = new Error(`Timed out after ${ms}ms`)
      err.code = 'TTS_TIMEOUT'
      rej(err)
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {string} text
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
export async function synthesizeNeuralSpeech(text) {
  const r = resolveNeuralTtsProvider()
  if (!r.ok) {
    const err = new Error('Neural TTS not configured')
    err.code = r.code
    throw err
  }
  if (r.provider === 'openai') {
    const hasGemini = Boolean(readGeminiApiKeyFromEnv())
    const parsed = Number.parseInt(process.env.OPENAI_TTS_FAILFAST_MS ?? '', 10)
    const failFastMs = Number.isFinite(parsed) && parsed >= 800 ? parsed : 28000

    const tryOpenAi = async () => {
      const buffer = await synthesizeSpeechToMp3(text)
      return { buffer, contentType: 'audio/mpeg' }
    }

    try {
      if (ttsProviderIsAutoOrUnset() && hasGemini) {
        const buffer = await withTimeout(failFastMs, synthesizeSpeechToMp3(text))
        return { buffer, contentType: 'audio/mpeg' }
      }
      return await tryOpenAi()
    } catch (e) {
      const hasGemini2 = Boolean(readGeminiApiKeyFromEnv())
      if (ttsProviderIsAutoOrUnset() && hasGemini2) {
        if (e?.code === 'TTS_TIMEOUT') {
          try {
            return await tryOpenAi()
          } catch (e2) {
            console.warn('[neural TTS] OpenAI failed after slow retry; using Gemini fallback.', e2?.message ?? e2)
            const buffer = await synthesizeSpeechToWav(text)
            return { buffer, contentType: 'audio/wav' }
          }
        }
        console.warn('[neural TTS] OpenAI failed; using Gemini fallback.', e?.message ?? e)
        const buffer = await synthesizeSpeechToWav(text)
        return { buffer, contentType: 'audio/wav' }
      }
      throw e
    }
  }

  try {
    const buffer = await synthesizeSpeechToWav(text)
    return { buffer, contentType: 'audio/wav' }
  } catch (e) {
    const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim())
    const explicitGemini = process.env.TTS_PROVIDER?.trim().toLowerCase() === 'gemini'
    const geminiQuota = e?.code === 'GEMINI_TTS_QUOTA' || e?.status === 429
    const useOpenAiFallback =
      hasOpenai &&
      (ttsProviderIsAutoOrUnset() ||
        (explicitGemini && geminiQuota) ||
        (explicitGemini && openAiFallbackOnAnyGeminiErrorEnabled()))
    if (useOpenAiFallback) {
      console.warn('[neural TTS] Gemini TTS failed; using OpenAI fallback.', e?.message ?? e)
      const buffer = await synthesizeSpeechToMp3(text)
      return { buffer, contentType: 'audio/mpeg' }
    }
    throw e
  }
}
