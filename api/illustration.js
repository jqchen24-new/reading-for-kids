import { generateSceneIllustrationDataUrl } from './sceneIllustration.js'
import { readGeminiApiKeyFromEnv } from './geminiApiKey.js'
import { parseEstablishedIllustrationCast } from './illustrationCastPrompt.js'
import { parseHeroGender } from './heroGender.js'
import { readRequestBody } from './readRequestBody.js'
import { isSceneIllustrationsEnabled } from './sceneIllustrationsEnv.js'

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

/**
 * Vercel Serverless — POST /api/illustration
 * Body: { "narration", "genre"?, "heroName"?, "heroGender"?, "heroReferenceImage"? (data URL), "lastChoice"?, "sceneNumber"?, "establishedIllustrationCast"? }
 * Response: { "illustrationUrl": "data:image/...;base64,..." } (data URL) or 503 when disabled / not configured.
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

  if (!isSceneIllustrationsEnabled()) {
    sendJson(res, 503, {
      error: 'Scene illustrations are disabled.',
      code: 'ILLUSTRATIONS_DISABLED',
    })
    return
  }

  if (!readGeminiApiKeyFromEnv()) {
    sendJson(res, 503, {
      error: 'Illustrations need GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) on the server.',
      code: 'MISSING_GEMINI_KEY',
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

  const narration = typeof body.narration === 'string' ? body.narration.trim() : ''
  if (!narration) {
    sendJson(res, 400, { error: 'Missing narration' })
    return
  }

  const genre = typeof body.genre === 'string' ? body.genre.trim() : ''
  const heroName = typeof body.heroName === 'string' ? body.heroName.trim() : ''
  const lastChoice = typeof body.lastChoice === 'string' ? body.lastChoice.trim() : ''
  const sceneNum = Number.parseInt(String(body.sceneNumber ?? ''), 10)
  const sceneNumber = Number.isFinite(sceneNum) ? sceneNum : undefined
  const establishedIllustrationCast = parseEstablishedIllustrationCast(body.establishedIllustrationCast)
  const heroGender = parseHeroGender(body.heroGender)
  const heroReferenceDataUrl =
    typeof body.heroReferenceImage === 'string' && body.heroReferenceImage.startsWith('data:image/')
      ? body.heroReferenceImage
      : undefined

  try {
    const illustrationUrl = await generateSceneIllustrationDataUrl({
      narration,
      genre,
      heroName,
      heroGender,
      heroReferenceDataUrl,
      lastChoice,
      sceneNumber,
      establishedIllustrationCast,
    })
    if (
      typeof illustrationUrl !== 'string' ||
      !illustrationUrl.startsWith('data:image/')
    ) {
      sendJson(res, 502, {
        error: 'Could not generate illustration.',
        code: 'ILLUSTRATION_FAILED',
      })
      return
    }
    sendJson(res, 200, { illustrationUrl })
  } catch (err) {
    console.error('[api/illustration]', err)
    sendJson(res, 502, {
      error: 'Could not generate illustration.',
      code: 'ILLUSTRATION_FAILED',
    })
  }
}
