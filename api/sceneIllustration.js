import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'
import { buildHeroVisualAnchor } from './heroVisualAnchor.js'

/** Ratios supported by ImageConfig (string), per Generative Language API. */
const GEMINI_IMAGE_ASPECT_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '21:9',
])

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeGeminiImageAspectRatio(raw) {
  const v = typeof raw === 'string' ? raw.trim().replace(/\u2236/g, ':') : ''
  if (GEMINI_IMAGE_ASPECT_RATIOS.has(v)) return v
  return '16:9'
}

/**
 * Gemini native image generation (Google AI Studio key, server-side only).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 * @param {{ narration: string, genre?: string, heroName?: string, lastChoice?: string, sceneNumber?: number }} input
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

  const visualAnchor = buildHeroVisualAnchor(hero, genre)

  const lastChoice =
    typeof input.lastChoice === 'string' && input.lastChoice.trim()
      ? input.lastChoice.trim().slice(0, 200)
      : ''
  const sceneNum = Number.isFinite(input.sceneNumber) ? Math.min(6, Math.max(1, input.sceneNumber)) : 1
  const branchLine =
    lastChoice && sceneNum > 1
      ? `This moment follows the reader's choice: "${lastChoice}". Show that situation visually (no text in the image).`
      : ''

  const prompt = [
    "Children's picture-book illustration for ages 7–9.",
    'Warm colors, friendly and imaginative, single clear moment, painterly or soft digital style.',
    'Do not include readable text, letters, captions, logos, or watermarks in the image.',
    'Safe and mild — no gore, weapons, or scary horror imagery.',
    visualAnchor,
    `Genre: ${genre}. Main character: ${hero}.`,
    branchLine,
    `Scene to depict: ${narration}`,
  ]
    .filter(Boolean)
    .join(' ')

  const model =
    process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-2.5-flash-image'
  const aspectRatio = normalizeGeminiImageAspectRatio(
    process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || '16:9',
  )

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`

  // imageConfig.aspectRatio is a string ("16:9"). Do not use responseFormat.image.aspectRatio —
  // the API maps that field to an enum and rejects string ratios (400 INVALID_ARGUMENT).
  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      aspectRatio,
    },
  }

  const body = {
    contents: [
      {
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

    const block =
      json?.promptFeedback?.blockReason ??
      json?.prompt_feedback?.block_reason ??
      json?.promptFeedback?.block_reason
    if (block) {
      lastErr = new Error(`Gemini blocked image generation: ${block}`)
      lastErr.code = 'GEMINI_IMAGE_BLOCKED'
      throw lastErr
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
  const candidates = json?.candidates
  if (!Array.isArray(candidates)) return null

  for (const cand of candidates) {
    const parts = cand?.content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      const inline = part.inlineData ?? part.inline_data
      if (!inline?.data) continue
      const mime = String(inline.mimeType ?? inline.mime_type ?? 'image/png').toLowerCase()
      if (!mime.startsWith('image/')) continue
      return { mime, b64: inline.data }
    }
  }
  return null
}
