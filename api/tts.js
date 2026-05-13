import { synthesizeNeuralSpeech } from './neuralTtsRun.js'
import { resolveNeuralTtsProvider } from './resolveNeuralTts.js'
import { readRequestBody } from './readRequestBody.js'

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

/**
 * Vercel Serverless — POST /api/tts
 * Body: { "text": "..." } → audio/mpeg (OpenAI) or audio/wav (Gemini), per env.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const ttsResolved = resolveNeuralTtsProvider()
  if (!ttsResolved.ok) {
    const messages = {
      MISSING_OPENAI_KEY: 'Neural narration: set OPENAI_API_KEY or choose another provider.',
      MISSING_GEMINI_KEY:
        'Neural narration: set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) or choose another provider.',
      MISSING_NEURAL_TTS:
        'Neural narration is not configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY (optional TTS_PROVIDER).',
      INVALID_TTS_PROVIDER:
        'Invalid TTS_PROVIDER. Use auto, openai, or gemini.',
    }
    sendJson(res, 503, {
      error: messages[ttsResolved.code] ?? 'Neural narration is not configured.',
      code: ttsResolved.code,
    })
    return
  }

  let raw = ''
  try {
    raw = await readRequestBody(req)
  } catch {
    sendJson(res, 400, { error: 'Could not read request body' })
    return
  }

  let body = {}
  try {
    body = raw ? JSON.parse(raw) : {}
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    sendJson(res, 400, { error: 'Missing text' })
    return
  }

  try {
    const { buffer: buf, contentType } = await synthesizeNeuralSpeech(text)
    res.statusCode = 200
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.end(buf)
  } catch (err) {
    if (
      err?.code === 'MISSING_OPENAI_KEY' ||
      err?.code === 'MISSING_GEMINI_KEY' ||
      err?.code === 'MISSING_NEURAL_TTS'
    ) {
      sendJson(res, 503, { error: 'Neural narration is not configured.', code: err.code })
      return
    }
    console.error('[api/tts]', err)
    sendJson(res, 502, { error: 'Could not generate speech.', code: 'TTS_FAILED' })
  }
}
