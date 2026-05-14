/**
 * Parse a data URL for Gemini inline image input (PNG/JPEG/WebP base64).
 * @param {unknown} raw
 * @returns {{ mimeType: string, data: string } | null} base64 payload without data: prefix
 */
export function parseDataUrlImageForGemini(raw) {
  if (typeof raw !== 'string') return null
  const t = raw.trim().replace(/\s/g, '')
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(t)
  if (!m) return null
  const mimeType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase()
  const data = m[2]
  if (data.length < 100) return null
  const approxBytes = Math.floor((data.length * 3) / 4)
  if (approxBytes > 6_500_000) return null
  return { mimeType, data }
}
