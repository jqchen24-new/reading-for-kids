import Anthropic from '@anthropic-ai/sdk'
import { parseHeroGender, heroGenderNarrationRule } from './heroGender.js'
import { parseEstablishedIllustrationCast } from './illustrationCastPrompt.js'
import { parseSceneFromModelText } from './parseSceneJson.js'

const SYSTEM_PROMPT = `You are a children's story narrator for ages 7–9. You write in a warm, exciting, age-appropriate voice. Each scene should be 3–5 sentences. Keep peril mild and safe; no graphic violence, no romance, no profanity. The named hero is always the protagonist.

This is ONE continuous branching adventure, not isolated vignettes. When "STORY SO FAR" is provided, it is canonical: build the next scene as the immediate sequel—same world, same relationships, same facts. Do not reset tone as if starting a new tale.

Characters who already met in prior scenes already know each other. Do not have them introduce themselves again, repeat their name and species as a first meeting, or replay the same greeting or backstory unless the plot needs a single brief nod (a few words), never a full re-introduction.

This is a branching interactive story: after scene 1, every new scene MUST follow the reader's latest choice and show clear consequences before adding new twists. Never ignore, skip, or contradict the branch they just picked.

When you output "illustrationCast", each supporting character's "look" sentence is the official design for them for the whole story: keep it stable across scenes. If the user lists ESTABLISHED SUPPORTING CAST lines, reuse those exact look strings verbatim for the same names. Each look should name a repeatable outfit (garments + colors) so illustrations stay consistent.

The reader may set hero gender (girl, boy, or neutral) in the story setup — honor that with matching pronouns for the hero for the whole run.

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

  const establishedIllustrationCast = parseEstablishedIllustrationCast(b.establishedIllustrationCast)

  const priorSceneNarrations = Array.isArray(b.priorSceneNarrations)
    ? b.priorSceneNarrations
        .filter((s) => typeof s === 'string' && s.trim())
        .map((s) => s.trim().slice(0, 1600))
        .slice(0, 5)
    : []

  const heroGender = parseHeroGender(b.heroGender)

  return { genre, heroName, sceneNumber, choiceHistory, establishedIllustrationCast, priorSceneNarrations, heroGender }
}

function buildUserPrompt({
  genre,
  heroName,
  sceneNumber,
  choiceHistory,
  establishedIllustrationCast,
  priorSceneNarrations,
  heroGender,
}) {
  const historyLines =
    choiceHistory.length === 0
      ? '(none yet)'
      : choiceHistory.map((c, i) => `${i + 1}. ${c}`).join('\n')

  const lastChoice =
    choiceHistory.length > 0 ? choiceHistory[choiceHistory.length - 1].trim() : ''

  const storySoFarBlock =
    priorSceneNarrations.length === 0
      ? 'STORY SO FAR: (none — this is the opening scene.)'
      : `STORY SO FAR (canonical text the reader already saw; continue the same thread; do not contradict or soft-reboot):\n${priorSceneNarrations
          .map((text, i) => `--- Prior scene ${i + 1} ---\n${text}`)
          .join('\n\n')}`

  const branchInstructions =
    sceneNumber <= 1
      ? `Scene 1: start a fresh opening. There are no prior reader choices yet.`
      : lastChoice
        ? `BRANCHING (critical): The reader's LATEST choice, which leads directly into THIS scene, was:\n"${lastChoice}"\n\n` +
          `Your narration MUST:\n` +
          `- Open by showing what happens because they picked that (location, action, discovery, or dialogue tied to it).\n` +
          `- Stay consistent with all earlier choices listed above, especially this last one.\n` +
          `- Not reset the plot, not "meanwhile elsewhere," and not follow a different branch than "${lastChoice}".`
        : `Continue the story coherently from the prior scene even though choice text is missing from history.`

  const continuityTail =
    sceneNumber > 1 && priorSceneNarrations.length > 0
      ? `\nAlso anchor to how the last prior scene ended (where they were, what just happened, who was present). Continue in the same moment unless the reader's choice clearly moves them—no disconnected soft reboot.`
      : ''

  const heroKey = heroName.trim().toLowerCase()
  const establishedLines = Object.keys(establishedIllustrationCast).length
    ? `ESTABLISHED SUPPORTING CAST (lowercase keys; if any name appears again in this scene, copy their look string EXACTLY from here — do not rewrite):\n${Object.entries(establishedIllustrationCast)
        .filter(([k]) => k && k !== heroKey)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')}`
    : '(none yet — introduce 0–4 supporting characters with vivid one-line looks as needed.)'

  const endingRules =
    sceneNumber >= 6
      ? `This is the FINAL scene (scene 6 of 6). Write a satisfying conclusion that wraps up the adventure. Set "isEnding" to true and "choices" to an empty array []. Do not offer new branches.`
      : `Provide exactly 2 distinct, concrete choices for what ${heroName} does next. Set "isEnding" to false.`

  return `Story setup:
- Genre: ${genre}
- Hero name: ${heroName}
- ${heroGenderNarrationRule(heroGender)}
- Target age: 7–9
- Scene: ${sceneNumber} of 6
- Choices made so far (in order, each is what the reader tapped after the previous scene):
${historyLines}

${storySoFarBlock}

${establishedLines}

${branchInstructions}${continuityTail}

Write the next scene and follow the ending rules below.

${endingRules}

Respond in this exact JSON shape (keys required; include "illustrationCast" as an array, using [] if no named supporting characters appear):
{
  "narration": "Scene text here...",
  "choices": ["Choice A", "Choice B"],
  "isEnding": false,
  "illustrationCast": [
    { "name": "SupportingName", "look": "One sentence: species/build, hair or fur, a specific outfit with garment names and colors, one memorable prop. Repeat the same outfit wording when they return." }
  ]
}

Rules for "illustrationCast":
- Always include the key. Use an empty array [] if no named supporting characters appear in this scene.
- At most 4 objects. Do NOT include the hero "${heroName}" (the app locks the hero separately).
- List named supporting characters who appear in THIS scene's narration (friends, pets, robots, mentors, rivals, etc.).
- If a name appears in ESTABLISHED SUPPORTING CAST above, reuse that exact "look" string (same spelling and punctuation).
- For brand-new names, write a new vivid "look" sentence that names stable clothes (shirt, pants, dress, vest, etc.) and colors so the same outfit can be redrawn in later scenes. Do not change their costume later unless the plot truly replaces it (then update once and keep the new string).

If this is the final scene, use "choices": [] and "isEnding": true (illustrationCast may still list who appears in the ending).`
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
