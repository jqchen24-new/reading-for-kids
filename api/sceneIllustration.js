import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'
import { buildHeroVisualLock } from './heroVisualAnchor.js'
import { formatEstablishedSupportingCast, parseEstablishedIllustrationCast } from './illustrationCastPrompt.js'
import { softenWardrobeLanguageForImage } from './narrationImageSanitize.js'
import { parseDataUrlImageForGemini } from './parseDataUrlImage.js'

/** Ratios supported by ImageConfig (string), per Generative Language API / Nano Banana family. */
const GEMINI_IMAGE_ASPECT_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
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
 * Default model is **Nano Banana 2** (`gemini-3.1-flash-image-preview`). Override with `GEMINI_IMAGE_MODEL`.
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 * @param {{ narration: string, genre?: string, heroName?: string, heroGender?: string, heroReferenceDataUrl?: string, lastChoice?: string, sceneNumber?: number, establishedIllustrationCast?: Record<string, string> }} input
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

  const visualLock = buildHeroVisualLock(hero, genre, input.heroGender)

  const heroLo = hero.trim().toLowerCase()
  const supportMap = parseEstablishedIllustrationCast(input.establishedIllustrationCast)
  const supportLock =
    Object.keys(supportMap).length > 0
      ? `SUPPORTING CAST LOCK (series canon — reuse exactly; do not redesign faces, species, body shape, hair or fur, skin, or the core garments and colors listed; only pose, expression, and placement may change. If narration mentions different clothes, keep the lock and use removable props only):\n${formatEstablishedSupportingCast(supportMap, heroLo)}`
      : ''

  const lastChoice =
    typeof input.lastChoice === 'string' && input.lastChoice.trim()
      ? input.lastChoice.trim().slice(0, 200)
      : ''
  const sceneNum = Number.isFinite(input.sceneNumber) ? Math.min(6, Math.max(1, input.sceneNumber)) : 1
  const branchLine =
    lastChoice && sceneNum > 1
      ? `This moment follows the reader's choice: "${lastChoice}". Show that situation visually (no text in the image).`
      : ''

  const refParsed = parseDataUrlImageForGemini(input.heroReferenceDataUrl)
  const narrationForImage =
    sceneNum > 1 ? softenWardrobeLanguageForImage(narration) : narration

  const outfitLock =
    `HERO WARDROBE (absolute — same shirt/pants/dress layers and colors every image): "${visualLock.heroOutfitExact}". ACCESSORY (always): "${visualLock.heroAccessoryExact}". ` +
    `The protagonist "${hero}" must never get a new costume from story text — only this wardrobe (or the reference image) with pose changed. `

  const promptText = [
    visualLock.lockBlock,
    outfitLock,
    supportLock,
    'OUTFIT AND CAST INTEGRITY: For the hero and every name in SUPPORTING CAST LOCK, only the LOCK text defines their clothes, hair, and body. SCENE ACTION describes what happens — it must NOT replace locked outfits, haircuts, species, or gender presentation. If the narration mentions armor, uniforms, disguises, or costume changes, show those as removable props (held helmet, folded cloak) or background elements, not as a redesign of locked characters.',
    "The narration below describes ONLY what is happening (action, setting, props). Do not let it change the protagonist's locked face, hair length, skin tone, gender presentation, or base outfit colors.",
    "Children's picture-book illustration for ages 7–9.",
    'Warm colors, friendly and imaginative, single clear moment, painterly or soft digital style.',
    'Do not include readable text, letters, captions, logos, or watermarks in the image.',
    'Safe and mild — no gore, weapons, or scary horror imagery.',
    `Genre: ${genre}. Protagonist name (for identity only): ${hero}.`,
    branchLine,
    `SCENE ACTION (setting, props, other characters, body pose — NOT new clothes for "${hero}"): ${narrationForImage}`,
    outfitLock,
    visualLock.lockRecap,
  ]
    .filter(Boolean)
    .join(' ')

  const configuredModel =
    process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image-preview'
  /** Widely available if preview / newer IDs are not enabled on the key yet. */
  const fallbackImageModel = 'gemini-2.5-flash-image'
  /** @type {string[]} */
  const modelChain = []
  for (const m of [configuredModel, fallbackImageModel]) {
    if (m && !modelChain.includes(m)) modelChain.push(m)
  }

  const aspectRatio = normalizeGeminiImageAspectRatio(
    process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || '16:9',
  )

  // imageConfig.aspectRatio is a string ("16:9"). Do not use responseFormat.image.aspectRatio —
  // the API maps that field to an enum and rejects string ratios (400 INVALID_ARGUMENT).
  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      aspectRatio,
    },
  }

  const textMax = refParsed ? 7200 : 8000
  const partsWithRef = refParsed
    ? [
        { inlineData: { mimeType: refParsed.mimeType, data: refParsed.data } },
        {
          text: (
            'The first input is a reference image of the protagonist from the opening scene. Generate ONE new illustration: keep the same child — same facial identity, hair shape and color, skin tone, body, gender presentation, and the same core outfit colors and garment types as the reference. Change only pose, expression, framing, lighting, background, and supporting characters per the text below. If any text conflicts with the reference face or outfit, follow the reference. The written OUTFIT lines in the prompt also define colors — if they disagree with the reference, prefer the REFERENCE image for cloth shapes and colors. ' +
            promptText
          ).slice(0, textMax),
        },
      ]
    : [{ text: promptText.slice(0, textMax) }]

  /**
   * @param {string} model
   */
  async function generateForModel(model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    try {
      return await geminiImageFromParts(partsWithRef, apiKey, url, generationConfig)
    } catch (e) {
      if (refParsed && e && typeof e === 'object' && 'status' in e && e.status === 400) {
        console.warn(
          '[sceneIllustration] multimodal reference rejected; retrying without reference image.',
          e instanceof Error ? e.message : e,
        )
        return await geminiImageFromParts(
          [{ text: promptText.slice(0, 8000) }],
          apiKey,
          url,
          generationConfig,
        )
      }
      throw e
    }
  }

  let lastErr = null
  for (let i = 0; i < modelChain.length; i++) {
    const model = modelChain[i]
    try {
      return await generateForModel(model)
    } catch (e) {
      lastErr = e
      const next = modelChain[i + 1]
      if (next && imageModelFailureWarrantsFallback(e)) {
        console.warn(
          `[sceneIllustration] image model "${model}" unavailable or rejected; retrying with "${next}".`,
          e instanceof Error ? e.message.slice(0, 280) : e,
        )
        continue
      }
      throw e
    }
  }

  throw lastErr ?? new Error('Gemini image generation failed')
}

/**
 * When the primary model ID is wrong for the API key, Google often returns 404 or 400 NOT_FOUND.
 * @param {unknown} err
 */
function imageModelFailureWarrantsFallback(err) {
  if (!err || typeof err !== 'object' || !('status' in err)) return false
  const status = /** @type {{ status?: number }} */ (err).status
  if (status === 404 || status === 403) return true
  if (status !== 400) return false
  const msg = err instanceof Error ? err.message : String(err)
  return /not\s+found|NOT_FOUND|does not exist|invalid.*model|is not supported|ListModels/i.test(msg)
}

/**
 * @param {unknown[]} parts
 * @param {string} apiKey
 * @param {string} url
 * @param {{ responseModalities: string[], imageConfig: { aspectRatio: string } }} generationConfig
 */
async function geminiImageFromParts(parts, apiKey, url, generationConfig) {
  const body = {
    contents: [
      {
        parts,
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
