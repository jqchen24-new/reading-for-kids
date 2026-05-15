/**
 * OpenAI Text-to-Speech — used server-side only (key in env, never in the client bundle).
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
export async function synthesizeSpeechToMp3(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not set')
    err.code = 'MISSING_OPENAI_KEY'
    throw err
  }

  const input = typeof text === 'string' ? text.trim().slice(0, 4096) : ''
  if (!input) {
    const err = new Error('Empty text')
    err.code = 'BAD_INPUT'
    throw err
  }

  const model = process.env.OPENAI_TTS_MODEL?.trim() || 'tts-1-hd'
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || 'nova'
  const speedRaw = Number.parseFloat(process.env.OPENAI_TTS_SPEED ?? '0.92')
  const speed = Number.isFinite(speedRaw)
    ? Math.min(1.15, Math.max(0.8, speedRaw))
    : 0.92

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input,
      response_format: 'mp3',
      speed,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    const err = new Error(body || `OpenAI TTS HTTP ${res.status}`)
    err.status = res.status
    err.code =
      res.status === 429 || /insufficient_quota|exceeded your current quota/i.test(body)
        ? 'OPENAI_TTS_QUOTA'
        : 'OPENAI_TTS_ERROR'
    throw err
  }

  return Buffer.from(await res.arrayBuffer())
}
