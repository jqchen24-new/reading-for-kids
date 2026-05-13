import { generateStoryScene, normalizeStoryPayload } from './generateScene.js'
import { mapStoryGenerationError } from './mapStoryGenerationError.js'
import { readRequestBody } from './readRequestBody.js'
import { STUB_SCENE_RESPONSE } from './_stubPayload.js'

function sendJson(res, statusCode, obj) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(obj))
}

/**
 * Vercel Serverless Function — POST /api/story
 * Anthropic key stays in process.env (Vercel env or local .env with vercel dev).
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

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    sendJson(res, 503, {
      error: 'Story server is not configured',
      code: 'MISSING_API_KEY',
      fallback: STUB_SCENE_RESPONSE,
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
  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' })
      return
    }
  }

  const payload = normalizeStoryPayload(body)

  try {
    const scene = await generateStoryScene(payload)
    sendJson(res, 200, scene)
  } catch (err) {
    console.error('[api/story]', err)
    const { status, body } = mapStoryGenerationError(err)
    sendJson(res, status, body)
  }
}
