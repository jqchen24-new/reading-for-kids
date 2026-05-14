import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'

const TRANSIENT_GEMINI_HTTP = new Set([429, 500, 502, 503])

function parseHttpRetries() {
  const n = Number.parseInt(process.env.GEMINI_TTS_HTTP_RETRIES ?? '', 10)
  if (Number.isFinite(n)) return Math.min(8, Math.max(2, n))
  return 5
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * @param {Response} res
 * @param {string} rawText
 */
function geminiHttpErrorMessage(res, rawText) {
  let message = rawText || `Gemini TTS HTTP ${res.status}`
  try {
    const j = JSON.parse(rawText)
    const details = j?.error?.details
    const invalid = Array.isArray(details)
      ? details.some((d) => d?.reason === 'API_KEY_INVALID')
      : false
    if (invalid) {
      return (
        'Gemini API_KEY_INVALID: wrong/revoked key, or key restrictions block server use. Create a key at https://aistudio.google.com/app/apikey . In Google Cloud → Credentials → that key: for local dev set Application restrictions to None (HTTP referrer rules break Node /api/tts). Raw: ' +
        rawText
      )
    }
    const status = j?.error?.status
    if (res.status === 503 || status === 'UNAVAILABLE') {
      return (
        'Gemini TTS temporarily unavailable (503 UNAVAILABLE). This is usually on Google’s side — wait a minute and try again, or try another model via GEMINI_TTS_MODEL (see https://ai.google.dev/gemini-api/docs/speech-generation ). Raw: ' +
        rawText
      )
    }
  } catch {
    /* keep message */
  }
  return message
}

/**
 * @param {unknown} err
 * @param {string} primary
 * @param {string} fallback
 */
function geminiErrorWarrantsModelFallback(err, primary, fallback) {
  if (!fallback || fallback === primary) return false
  if (!err || typeof err !== 'object') return false
  const status = /** @type {{ status?: number }} */ (err).status
  const msg = err instanceof Error ? err.message : String(err)
  if (status === 404 || status === 403) return true
  if (status === 503) return true
  if (/** @type {{ code?: string }} */ (err).code === 'GEMINI_TTS_EMPTY') return true
  return /not\s+found|NOT_FOUND|UNAVAILABLE|invalid.*model|is not supported/i.test(msg)
}

/**
 * @param {string} model
 * @param {string} clipped
 * @param {string} voiceName
 * @param {string} apiKey
 * @returns {Promise<Buffer>}
 */
async function generateGeminiTtsBuffer(model, clipped, voiceName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  const body = {
    contents: [
      {
        parts: [{ text: clipped }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  }

  const httpRetries = parseHttpRetries()
  let lastEmpty = false

  for (let emptyAttempt = 0; emptyAttempt < 3; emptyAttempt++) {
    if (emptyAttempt > 0) {
      await sleep(350 + emptyAttempt * 250)
    }

    let res
    let rawText = ''
    for (let httpTry = 0; httpTry < httpRetries; httpTry++) {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      rawText = await res.text()
      if (res.ok) break

      const transient = TRANSIENT_GEMINI_HTTP.has(res.status)
      if (transient && httpTry < httpRetries - 1) {
        const backoff = 400 * 2 ** httpTry + Math.floor(Math.random() * 180)
        await sleep(backoff)
        continue
      }

      const err = new Error(geminiHttpErrorMessage(res, rawText))
      err.status = res.status
      err.code = res.status === 429 ? 'GEMINI_TTS_QUOTA' : 'GEMINI_TTS_ERROR'
      throw err
    }

    let json
    try {
      json = JSON.parse(rawText)
    } catch {
      const err = new Error('Invalid JSON from Gemini TTS')
      err.code = 'GEMINI_TTS_ERROR'
      throw err
    }

    const chunk = extractAudioPart(json)
    if (!chunk) {
      lastEmpty = true
      continue
    }

    if (chunk.format === 'wav') return chunk.data
    return wrapPcmAsWav(chunk.data, 24000, 1, 16)
  }

  const err = new Error(
    lastEmpty ? 'No audio in Gemini TTS response' : 'Gemini TTS failed',
  )
  err.code = lastEmpty ? 'GEMINI_TTS_EMPTY' : 'GEMINI_TTS_ERROR'
  throw err
}

/**
 * Gemini native TTS (Google AI Studio key, server-side only).
 * @see https://ai.google.dev/gemini-api/docs/speech-generation
 * @param {string} text
 * @returns {Promise<Buffer>} WAV (browser-playable) or API-returned WAV bytes
 */
export async function synthesizeSpeechToWav(text) {
  const apiKey = readGeminiApiKeyFromEnv()
  if (!apiKey) {
    const err = new Error(
      'No Gemini API key: set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY',
    )
    err.code = 'MISSING_GEMINI_KEY'
    throw err
  }

  const input = typeof text === 'string' ? text.trim() : ''
  if (!input) {
    const err = new Error('Empty text')
    err.code = 'BAD_INPUT'
    throw err
  }

  const primaryModel =
    process.env.GEMINI_TTS_MODEL?.trim() || 'gemini-2.5-flash-preview-tts'
  const fallbackModel = process.env.GEMINI_TTS_MODEL_FALLBACK?.trim() || ''
  const voiceName = process.env.GEMINI_TTS_VOICE?.trim() || 'Achird'

  const maxChars = Math.max(256, Number.parseInt(process.env.GEMINI_TTS_MAX_CHARS ?? '', 10) || 6000)
  const clipped = input.slice(0, maxChars)

  try {
    return await generateGeminiTtsBuffer(primaryModel, clipped, voiceName, apiKey)
  } catch (e) {
    if (fallbackModel && geminiErrorWarrantsModelFallback(e, primaryModel, fallbackModel)) {
      console.warn(
        '[gemini TTS] primary model failed; retrying with GEMINI_TTS_MODEL_FALLBACK=',
        fallbackModel,
        e instanceof Error ? e.message.slice(0, 200) : e,
      )
      return await generateGeminiTtsBuffer(fallbackModel, clipped, voiceName, apiKey)
    }
    throw e
  }
}

/** @param {Buffer} pcm s16le mono */
function wrapPcmAsWav(pcm, sampleRate, numChannels, bitsPerSample) {
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

/** @returns {{ format: 'wav' | 'pcm', data: Buffer } | null} */
function extractAudioPart(json) {
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null

  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    if (!inline?.data) continue

    const mime = String(inline.mimeType ?? inline.mime_type ?? '').toLowerCase()
    const buf = Buffer.from(inline.data, 'base64')

    if (mime.includes('wav')) return { format: 'wav', data: buf }
    if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'RIFF') {
      return { format: 'wav', data: buf }
    }
    return { format: 'pcm', data: buf }
  }
  return null
}
