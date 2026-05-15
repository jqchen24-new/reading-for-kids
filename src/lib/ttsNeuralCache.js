/**
 * Neural TTS cache: in-memory (instant replay) + sessionStorage (survives refresh in-tab).
 * Keys are derived from narration text. Reuses blob URLs so replay skips decode + base64 work.
 */

const INDEX_KEY = 'rff-tts-v1-index'
const ENTRY_PREFIX = 'rff-tts-v1:'
const MAX_ENTRIES = 24
const MAX_BYTES_TO_CACHE = 750_000

/** @type {Map<string, { ab: ArrayBuffer, mime: string, objectUrl?: string, audioBuffer?: AudioBuffer }>} */
const memory = new Map()

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
  memory.delete(storageKey)
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} key
 * @returns {{ ab: ArrayBuffer, mime: string } | null}
 */
function readSessionEntry(key) {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const row = JSON.parse(raw)
    const mime = typeof row.mime === 'string' ? row.mime : 'audio/mpeg'
    const b64 = typeof row.b64 === 'string' ? row.b64 : ''
    if (!b64 || b64.length < 88) return null
    const ab = base64ToArrayBuffer(b64)
    if (ab.byteLength < 64) return null
    return { ab, mime }
  } catch {
    return null
  }
}

/**
 * @param {string} key
 * @param {{ ab: ArrayBuffer, mime: string }} entry
 */
function writeSessionEntry(key, entry) {
  if (typeof sessionStorage === 'undefined') return
  const { ab, mime } = entry
  if (ab.byteLength < 64 || ab.byteLength > MAX_BYTES_TO_CACHE) return
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

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasTtsNeuralCache(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return false
  const key = cacheKeyForText(t)
  const mem = memory.get(key)
  if (mem?.ab?.byteLength >= 64) return true
  if (typeof sessionStorage === 'undefined') return false
  try {
    return Boolean(sessionStorage.getItem(key))
  } catch {
    return false
  }
}

/**
 * @param {string} text
 * @returns {{ ab: ArrayBuffer, mime: string, objectUrl?: string, audioBuffer?: AudioBuffer } | null}
 */
export function getTtsNeuralCache(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return null
  const key = cacheKeyForText(t)

  const mem = memory.get(key)
  if (mem?.ab?.byteLength >= 64) {
    return mem
  }

  const fromSession = readSessionEntry(key)
  if (!fromSession) return null

  const entry = { ab: fromSession.ab, mime: fromSession.mime }
  memory.set(key, entry)
  return entry
}

/**
 * @param {string} text
 * @param {ArrayBuffer} ab
 * @param {string} mime
 */
export function setTtsNeuralCache(text, ab, mime) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || ab.byteLength < 64 || ab.byteLength > MAX_BYTES_TO_CACHE) return
  const key = cacheKeyForText(t)

  const prev = memory.get(key)
  if (prev?.objectUrl) {
    try {
      URL.revokeObjectURL(prev.objectUrl)
    } catch {
      /* ignore */
    }
  }

  const entry = { ab: ab.slice(0), mime: mime || 'audio/mpeg' }
  memory.set(key, entry)

  const persist = () => writeSessionEntry(key, entry)
  if (typeof queueMicrotask !== 'undefined') {
    queueMicrotask(persist)
  } else {
    persist()
  }
}

/**
 * Reused object URL for HTML Audio replay (do not revoke while cached).
 * @param {string} text
 * @returns {string | null}
 */
export function getTtsObjectUrl(text) {
  const entry = getTtsNeuralCache(text)
  if (!entry) return null
  if (!entry.objectUrl) {
    entry.objectUrl = URL.createObjectURL(new Blob([entry.ab], { type: entry.mime }))
  }
  return entry.objectUrl
}

/**
 * @param {string | undefined | null} url
 */
export function isCachedTtsObjectUrl(url) {
  if (!url) return false
  for (const entry of memory.values()) {
    if (entry.objectUrl === url) return true
  }
  return false
}

/**
 * @param {string} text
 * @param {AudioContext} ctx
 */
export function predecodeTtsBuffer(text, ctx) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || !ctx || ctx.state === 'closed') return
  const entry = getTtsNeuralCache(t)
  if (!entry || entry.audioBuffer) return
  const ab = entry.ab.slice(0)
  void ctx.decodeAudioData(
    ab,
    (buf) => {
      entry.audioBuffer = buf
    },
    () => {
      /* ignore */
    },
  )
}

/**
 * Load session blobs into memory during idle time (e.g. when flipping pages).
 * @param {string[]} texts
 */
export function warmTtsNeuralCaches(texts) {
  const list = (Array.isArray(texts) ? texts : [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
  if (list.length === 0) return

  const run = () => {
    for (const t of list) {
      getTtsNeuralCache(t)
    }
  }

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 600 })
  } else {
    queueMicrotask(run)
  }
}
