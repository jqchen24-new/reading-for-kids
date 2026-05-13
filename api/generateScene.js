import Anthropic from '@anthropic-ai/sdk'
import { parseSceneFromModelText } from './parseSceneJson.js'

const SYSTEM_PROMPT = `You are a children's story narrator for ages 7–9. You write in a warm, exciting, age-appropriate voice. Each scene should be 3–5 sentences. Keep peril mild and safe; no graphic violence, no romance, no profanity. The named hero is always the protagonist.

Always respond in valid JSON only — no extra text, no markdown, no code fences.`

/** @param {unknown} body */
export function normalizeStoryPayload(body) {
  const b = body && typeof body === 'object' ? body : {}
  const genre =
    typeof b.genre === 'string' && b.genre.trim() ? b.genre.trim().slice(0, 60) : 'Adventure'
  const heroName =
    typeof b.heroName === 'string' && b.heroName.trim()
      ? b.heroName.trim().slice(0, 40)
      : 'Hero'
  const n = Number.parseInt(String(b.sceneNumber ?? '1'), 10)
  const sceneNumber = Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 1
  const choiceHistory = Array.isArray(b.choiceHistory)
    ? b.choiceHistory.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim().slice(0, 200)).slice(0, 20)
    : []

  return { genre, heroName, sceneNumber, choiceHistory }
}

function buildUserPrompt({ genre, heroName, sceneNumber, choiceHistory }) {
  const historyLines =
    choiceHistory.length === 0
      ? '(none yet)'
      : choiceHistory.map((c, i) => `${i + 1}. ${c}`).join('\n')

  const endingRules =
    sceneNumber >= 6
      ? `This is the FINAL scene (scene 6 of 6). Write a satisfying conclusion that wraps up the adventure. Set "isEnding" to true and "choices" to an empty array []. Do not offer new branches.`
      : `Provide exactly 2 distinct, concrete choices for what ${heroName} does next. Set "isEnding" to false.`

  return `Story setup:
- Genre: ${genre}
- Hero name: ${heroName}
- Target age: 7–9
- Scene: ${sceneNumber} of 6
- Choices made so far (in order):
${historyLines}

Write the next scene and follow the ending rules below.

${endingRules}

Respond in this exact JSON shape (keys required):
{
  "narration": "Scene text here...",
  "choices": ["Choice A", "Choice B"],
  "isEnding": false
}

If this is the final scene, use "choices": [] and "isEnding": true.`
}

/**
 * Calls Claude and returns a validated scene object.
 * Uses process.env.ANTHROPIC_API_KEY and optional process.env.ANTHROPIC_MODEL.
 * @param {ReturnType<typeof normalizeStoryPayload>} payload
 */
export async function generateStoryScene(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not set')
    err.code = 'MISSING_API_KEY'
    throw err
  }

  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-6'

  const client = new Anthropic({ apiKey })
  const userContent = buildUserPrompt(payload)

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const textParts =
    message.content
      ?.filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .filter(Boolean) ?? []

  const joined = textParts.join('\n').trim()
  if (!joined) {
    throw new Error('No text content in model response')
  }

  return parseSceneFromModelText(joined)
}
