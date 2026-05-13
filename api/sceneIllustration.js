import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'

/**
 * Gemini native image generation (Google AI Studio key, server-side only).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 * @param {{ narration: string, genre?: string, heroName?: string }} input
 * @returns {Promise<string>} Data URL (e.g. data:image/png;base64,...) for use as img src
 */
export async function generateSceneIllustrationDataUrl(input) {
  const apiKey = readGeminiApiKeyFromEnv()
  if (!apiKey) {
    const err = new Error('No Gemini API key')
    err.code = 'MISSING_GEMINI_KEY'
    throw err
  }

  const narration = typeof input.narration === 'string' ? input.narration.trim().slice(0, 700) : ''
  if (!narration) {
    const err = new Error('Missing narration')
    err.code = 'BAD_INPUT'
    throw err
  }

  const genre = typeof input.genre === 'string' ? input.genre.trim().slice(0, 60) : 'Story'
  const hero =
    typeof input.heroName === 'string' && input.heroName.trim()
      ? input.heroName.trim().slice(0, 40)
      : 'the hero'

  const prompt = [
    "Children's picture-book illustration for ages 7–9.",
    'Warm colors, friendly and imaginative, single clear moment, painterly or soft digital style.',
    'Do not include readable text, letters, captions, logos, or watermarks in the image.',
    'Safe and mild — no gore, weapons, or scary horror imagery.',
    `Genre: ${genre}. Main character: ${hero}.`,
    `Scene to depict: ${narration}`,
  ].join(' ')

  const model =
    process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'
  const aspectRatio = process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || '16:9'
  const imageSize = process.env.GEMINI_IMAGE_SIZE?.trim() || '1K'

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  const isGemini3Image = /gemini-3.*image|image-preview/i.test(model)

  /** @type {Record<string, unknown>} */
  const imageFormat = isGemini3Image
    ? { aspectRatio, imageSize }
    : { aspectRatio }

  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    responseFormat: {
      image: imageFormat,
    },
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt.slice(0, 8000) }],
      },
    ],
    generationConfig,
  }

  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const rawText = await res.text()
    if (!res.ok) {
      const transient = res.status === 429 || res.status === 500 || res.status === 503
      if (transient && attempt === 0) {
        await new Promise((r) => setTimeout(r, 400))
        continue
      }
      const err = new Error(rawText || `Gemini image HTTP ${res.status}`)
      err.status = res.status
      err.code = 'GEMINI_IMAGE_ERROR'
      throw err
    }

    let json
    try {
      json = JSON.parse(rawText)
    } catch {
      const err = new Error('Invalid JSON from Gemini image')
      err.code = 'GEMINI_IMAGE_ERROR'
      throw err
    }

    const extracted = extractFirstImagePart(json)
    if (extracted) {
      return `data:${extracted.mime};base64,${extracted.b64}`
    }

    lastErr = new Error('No image in Gemini response')
    lastErr.code = 'GEMINI_IMAGE_EMPTY'
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  throw lastErr ?? new Error('Gemini image generation failed')
}

/** @returns {{ mime: string, b64: string } | null} */
function extractFirstImagePart(json) {
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null

  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    if (!inline?.data) continue
    const mime = String(inline.mimeType ?? inline.mime_type ?? 'image/png').toLowerCase()
    if (!mime.startsWith('image/')) continue
    return { mime, b64: inline.data }
  }
  return null
}
