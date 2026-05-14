/**
 * Session-scoped cache for neural TTS blobs (same narration replay / prefetch hits).
 * Uses sessionStorage with size caps; fails quietly in private mode or quota errors.
 */

const INDEX_KEY = 'rff-tts-v1-index'
const ENTRY_PREFIX = 'rff-tts-v1:'
const MAX_ENTRIES = 18
/** Skip caching huge responses (base64 inflates ~4/3). */
const MAX_BYTES_TO_CACHE = 750_000

/**
 * @param {string} text
 */
function cacheKeyForText(text) {
  let h = 2166136261
  const t = typeof text === 'string' ? text : ''
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `${ENTRY_PREFIX}${(h >>> 0).toString(36)}:${t.length}`
}

/**
 * @param {ArrayBuffer} ab
 */
function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)))
  }
  return btoa(binary)
}

/**
 * @param {string} b64
 */
function base64ToArrayBuffer(b64) {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function readIndex() {
  if (typeof sessionStorage === 'undefined') return /** @type {string[]} */ ([])
  try {
    const raw = sessionStorage.getItem(INDEX_KEY)
    if (!raw) return []
    const j = JSON.parse(raw)
    return Array.isArray(j) ? j.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

function writeIndex(keys) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(INDEX_KEY, JSON.stringify(keys.slice(0, MAX_ENTRIES)))
  } catch {
    /* quota */
  }
}

function removeEntry(storageKey) {
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} text
 * @returns {{ mime: string, ab: ArrayBuffer } | null}
 */
export function getTtsNeuralCache(text) {
  if (typeof sessionStorage === 'undefined') return null
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return null
  const key = cacheKeyForText(t)
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const row = JSON.parse(raw)
    const mime = typeof row.mime === 'string' ? row.mime : 'audio/mpeg'
    const b64 = typeof row.b64 === 'string' ? row.b64 : ''
    if (!b64 || b64.length < 88) return null
    const ab = base64ToArrayBuffer(b64)
    if (ab.byteLength < 64) return null
    return { mime, ab }
  } catch {
    return null
  }
}

/**
 * @param {string} text
 * @param {ArrayBuffer} ab
 * @param {string} mime
 */
export function setTtsNeuralCache(text, ab, mime) {
  if (typeof sessionStorage === 'undefined') return
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || ab.byteLength < 64 || ab.byteLength > MAX_BYTES_TO_CACHE) return
  const key = cacheKeyForText(t)
  let b64
  try {
    b64 = arrayBufferToBase64(ab.slice(0))
  } catch {
    return
  }
  const payload = JSON.stringify({ mime: mime || 'audio/mpeg', b64 })
  if (payload.length > 1_200_000) return

  try {
    let idx = readIndex().filter((k) => k !== key)
    idx.unshift(key)
    while (idx.length > MAX_ENTRIES) {
      const drop = idx.pop()
      if (drop) removeEntry(drop)
    }
    sessionStorage.setItem(key, payload)
    writeIndex(idx)
  } catch {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
