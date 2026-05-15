/**
 * Neural TTS cache: in-memory (instant replay) + sessionStorage (survives refresh in-tab).
 * Keeps decoded buffers and a preloaded HTMLAudioElement so replay skips API + decode.
 */

const INDEX_KEY = 'rff-tts-v1-index'
const ENTRY_PREFIX = 'rff-tts-v1:'
const MAX_ENTRIES = 24
/** sessionStorage cap (browser quota is ~5 MB total, base64 inflates ~4/3). */
const MAX_BYTES_FOR_SESSION_STORAGE = 750_000
/** In-memory cap per entry — keeps Gemini WAV (~1–2 MB) playable for instant replay. */
const MAX_BYTES_IN_MEMORY = 8_000_000
/** Hard ceiling: drop entries above this (very long narrations, runaway sizes). */
const MAX_BYTES_TO_CACHE = MAX_BYTES_IN_MEMORY

/**
 * @typedef {{
 *   ab: ArrayBuffer,
 *   mime: string,
 *   objectUrl?: string,
 *   audioBuffer?: AudioBuffer,
 *   htmlAudio?: HTMLAudioElement,
 * }} TtsCacheEntry
 */

/** @type {Map<string, TtsCacheEntry>} */
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
  const entry = memory.get(storageKey)
  if (entry?.htmlAudio) {
    try {
      entry.htmlAudio.pause()
      entry.htmlAudio.removeAttribute('src')
      entry.htmlAudio.load()
    } catch {
      /* ignore */
    }
  }
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
  if (ab.byteLength < 64 || ab.byteLength > MAX_BYTES_FOR_SESSION_STORAGE) return
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

/** Evict oldest in-memory entries if Map grows beyond MAX_ENTRIES. */
function trimMemoryCache() {
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value
    if (!oldest) break
    const entry = memory.get(oldest)
    if (entry?.objectUrl) {
      try {
        URL.revokeObjectURL(entry.objectUrl)
      } catch {
        /* ignore */
      }
    }
    if (entry?.htmlAudio) {
      try {
        entry.htmlAudio.pause()
        entry.htmlAudio.removeAttribute('src')
        entry.htmlAudio.load()
      } catch {
        /* ignore */
      }
    }
    memory.delete(oldest)
  }
}

/**
 * @param {TtsCacheEntry} entry
 */
function ensureObjectUrl(entry) {
  if (!entry.objectUrl) {
    entry.objectUrl = URL.createObjectURL(new Blob([entry.ab], { type: entry.mime }))
  }
  return entry.objectUrl
}

/**
 * @param {TtsCacheEntry} entry
 * @returns {HTMLAudioElement}
 */
function ensureHtmlAudio(entry) {
  if (entry.htmlAudio) return entry.htmlAudio
  const url = ensureObjectUrl(entry)
  const audio = new Audio()
  try {
    audio.setAttribute('playsinline', '')
    audio.playsInline = true
  } catch {
    /* ignore */
  }
  audio.preload = 'auto'
  audio.src = url
  entry.htmlAudio = audio
  return audio
}

/**
 * @param {HTMLAudioElement} audio
 * @param {number} timeoutMs
 */
export function waitForCachedAudioReady(audio, timeoutMs = 4000) {
  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const done = () => {
      cleanup()
      resolve(audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    }
    const cleanup = () => {
      clearTimeout(timer)
      audio.removeEventListener('canplay', done)
      audio.removeEventListener('loadeddata', done)
    }
    audio.addEventListener('canplay', done, { once: true })
    audio.addEventListener('loadeddata', done, { once: true })
    try {
      audio.load()
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
    }, timeoutMs)
  })
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
 * @returns {TtsCacheEntry | null}
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
  trimMemoryCache()
  void prepareCachedHtmlAudio(t)

  if (ab.byteLength <= MAX_BYTES_FOR_SESSION_STORAGE) {
    const persist = () => writeSessionEntry(key, entry)
    if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(persist)
    } else {
      persist()
    }
  }
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function getTtsObjectUrl(text) {
  const entry = getTtsNeuralCache(text)
  if (!entry) return null
  return ensureObjectUrl(entry)
}

/**
 * @param {string} text
 * @returns {HTMLAudioElement | null}
 */
export function getTtsHtmlAudio(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t) return null
  const entry = getTtsNeuralCache(t)
  if (!entry) return null
  return ensureHtmlAudio(entry)
}

/**
 * @param {string} text
 */
export function prepareCachedHtmlAudio(text) {
  const t = typeof text === 'string' ? text.trim() : ''
  if (!t || typeof Audio === 'undefined') return Promise.resolve(false)
  const entry = getTtsNeuralCache(t)
  if (!entry) return Promise.resolve(false)
  const audio = ensureHtmlAudio(entry, t)
  return waitForCachedAudioReady(audio)
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
 * @param {HTMLAudioElement | null | undefined} audio
 */
export function isCachedHtmlAudioElement(audio) {
  if (!audio) return false
  for (const entry of memory.values()) {
    if (entry.htmlAudio === audio) return true
  }
  return false
}

/** Stop every cached <audio> element (prevents overlap when changing scenes). */
export function pauseAllTtsPlayback() {
  for (const entry of memory.values()) {
    const audio = entry.htmlAudio
    if (!audio) continue
    try {
      audio.pause()
      audio.currentTime = 0
      audio.ontimeupdate = null
      audio.onended = null
      audio.onerror = null
    } catch {
      /* ignore */
    }
  }
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
      void prepareCachedHtmlAudio(t)
    }
  }

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 400 })
  } else {
    queueMicrotask(run)
  }
}
