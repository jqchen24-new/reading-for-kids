/**
 * Server-side story generation. The browser calls POST /api/story only;
 * Anthropic + prompts will live in api/story.js later.
 */
export async function fetchStoryScene(payload) {
  const res = await fetch('/api/story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let message =
      typeof data.error === 'string' ? data.error : `Story API error: ${res.status}`
    if (typeof data.detail === 'string' && data.detail.trim()) {
      message = `${message} (${data.detail.trim()})`
    }
    const err = new Error(message)
    err.status = res.status
    err.code = data.code
    throw err
  }
  return data
}

/**
 * Optional scene art (Gemini image generation). Server returns 503 when disabled or missing key.
 * Success returns a data URL in `illustrationUrl`.
 * @param {{ narration: string, genre: string, heroName: string, heroGender?: string, lastChoice?: string, sceneNumber?: number, establishedIllustrationCast?: Record<string, string>, signal?: AbortSignal }} params
 * @returns {Promise<{ illustrationUrl?: string, disabled?: boolean, disableCode?: string }>}
 */
export async function fetchSceneIllustration({
  narration,
  genre,
  heroName,
  heroGender,
  lastChoice,
  sceneNumber,
  establishedIllustrationCast,
  signal,
}) {
  const res = await fetch('/api/illustration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      narration,
      genre,
      heroName,
      heroGender:
        heroGender === 'girl' || heroGender === 'boy' || heroGender === 'neutral'
          ? heroGender
          : 'neutral',
      ...(lastChoice?.trim() ? { lastChoice: lastChoice.trim() } : {}),
      ...(typeof sceneNumber === 'number' && Number.isFinite(sceneNumber)
        ? { sceneNumber }
        : {}),
      establishedIllustrationCast:
        establishedIllustrationCast &&
        typeof establishedIllustrationCast === 'object' &&
        !Array.isArray(establishedIllustrationCast)
          ? establishedIllustrationCast
          : {},
    }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (
    res.status === 503 &&
    (data.code === 'ILLUSTRATIONS_DISABLED' || data.code === 'MISSING_GEMINI_KEY')
  ) {
    return { disabled: true, disableCode: typeof data.code === 'string' ? data.code : undefined }
  }
  if (!res.ok) {
    const err = new Error(
      typeof data.error === 'string' ? data.error : `Illustration error: ${res.status}`,
    )
    err.status = res.status
    err.code = data.code
    throw err
  }
  const illustrationUrl =
    typeof data.illustrationUrl === 'string' &&
    (data.illustrationUrl.startsWith('http') || data.illustrationUrl.startsWith('data:'))
      ? data.illustrationUrl
      : undefined
  return illustrationUrl ? { illustrationUrl } : {}
}
