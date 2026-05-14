import { useCallback, useEffect, useRef, useState } from 'react'
import { isIOSLikeDevice } from '../lib/platform.js'
import { pickVoiceForNarration } from '../lib/pickSpeechVoice.js'
import { getTtsNeuralCache, setTtsNeuralCache } from '../lib/ttsNeuralCache.js'

/**
 * @param {string} text
 * @param {AbortSignal} signal
 * @returns {Promise<{ ab: ArrayBuffer, mime: string } | null>}
 */
async function fetchNeuralTtsWithRetry(text, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    })
    const ctRaw = res.headers.get('content-type') ?? ''
    const ct = ctRaw.toLowerCase()
    if (res.ok) {
      const blob = await res.blob()
      const looksLikeJsonError = ct.includes('application/json')
      if (blob.size >= 64 && !looksLikeJsonError) {
        const mimeFromHeader =
          ctRaw.split(';')[0].trim() || blob.type || 'audio/mpeg'
        const ab = await blob.arrayBuffer()
        return { ab, mime: mimeFromHeader }
      }
    }
    const transient =
      res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503
    if (attempt === 0 && transient && !signal.aborted) {
      await new Promise((r) => setTimeout(r, 480))
      continue
    }
    break
  }
  return null
}

/**
 * Read-aloud: prefers **neural TTS** via `POST /api/tts` (OpenAI or Gemini, server key) when configured,
 * otherwise **Web Speech** in the browser (robotic ceiling).
 *
 * Neural audio often needs an unlocked Web Audio context (call `primePlaybackFromGesture` from
 * real user input before async work) so playback still works after `await fetch`.
 */
export function useNarrator() {
  const [status, setStatus] = useState('idle')
  const [supported] = useState(
    () =>
      typeof window !== 'undefined' &&
      (typeof window.speechSynthesis !== 'undefined' || typeof Audio !== 'undefined'),
  )
  const [iosSpeechGestureOnly] = useState(() => isIOSLikeDevice())

  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)
  const abortRef = useRef(null)
  const audioContextRef = useRef(null)
  const bufferSourceRef = useRef(null)
  /** Cached neural response for instant replay / iOS prefetch. */
  const prefetchedRef = useRef(null)
  const prefetchAbortRef = useRef(null)
  const speakGenRef = useRef(0)

  const stopNeuralWebAudio = useCallback(() => {
    const src = bufferSourceRef.current
    if (src) {
      try {
        src.stop(0)
      } catch {
        /* already stopped */
      }
      bufferSourceRef.current = null
    }
  }, [])

  const cleanupAudio = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    stopNeuralWebAudio()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
      audioRef.current = null
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [stopNeuralWebAudio])

  /** Call synchronously from pointer/tap handlers so neural audio can play after async fetch. */
  const primePlaybackFromGesture = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return
      if (!audioContextRef.current) {
        audioContextRef.current = new AC()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }
    } catch {
      /* ignore */
    }
  }, [])

  const stop = useCallback(() => {
    speakGenRef.current += 1
    prefetchAbortRef.current?.abort()
    prefetchAbortRef.current = null
    prefetchedRef.current = null
    cleanupAudio()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setStatus('idle')
  }, [cleanupAudio])

  /** Warm `/api/tts` while the user reads (iOS has no auto-speak). */
  const prefetchNarration = useCallback((text) => {
    if (typeof window === 'undefined') return
    const t = typeof text === 'string' ? text.trim() : ''
    if (!t) return

    prefetchAbortRef.current?.abort()
    const ac = new AbortController()
    prefetchAbortRef.current = ac

    void (async () => {
      try {
        const hit = getTtsNeuralCache(t)
        if (hit?.ab?.byteLength >= 64) {
          if (ac.signal.aborted) return
          prefetchedRef.current = { key: t, ab: hit.ab.slice(0), mime: hit.mime }
          return
        }
        const fetched = await fetchNeuralTtsWithRetry(t, ac.signal)
        if (!fetched || ac.signal.aborted) return
        prefetchedRef.current = { key: t, ab: fetched.ab.slice(0), mime: fetched.mime }
        setTtsNeuralCache(t, fetched.ab.slice(0), fetched.mime)
      } catch {
        /* aborted or network */
      }
    })()
  }, [])

  /** Prime voice list for Web Speech fallback. */
  useEffect(() => {
    if (!supported || typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    const kick = () => {
      synth.getVoices()
    }
    kick()
    synth.addEventListener('voiceschanged', kick)
    return () => synth.removeEventListener('voiceschanged', kick)
  }, [supported])

  const speak = useCallback(
    async (text) => {
      if (typeof window === 'undefined') return
      const t = typeof text === 'string' ? text.trim() : ''
      if (!t) return

      const myGen = ++speakGenRef.current

      prefetchAbortRef.current?.abort()
      prefetchAbortRef.current = null

      cleanupAudio()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }

      setStatus('loading')

      const tryPlayNeuralAb = async (ab, mimeFromHeader) => {
        if (speakGenRef.current !== myGen) return false

        prefetchedRef.current = { key: t, ab: ab.slice(0), mime: mimeFromHeader }

        const ctx = audioContextRef.current
        if (ctx && ctx.state !== 'closed') {
          if (ctx.state === 'suspended') {
            try {
              await ctx.resume()
            } catch {
              /* ignore */
            }
          }
          if (ctx.state === 'running') {
            try {
              const audioBuffer = await new Promise((resolve, reject) => {
                void ctx.decodeAudioData(ab.slice(0), resolve, reject)
              })
              if (speakGenRef.current !== myGen) return false
              const source = ctx.createBufferSource()
              bufferSourceRef.current = source
              source.buffer = audioBuffer
              source.connect(ctx.destination)
              const sourceGen = myGen
              source.onended = () => {
                bufferSourceRef.current = null
                if (speakGenRef.current === sourceGen) setStatus('idle')
              }
              setStatus('playing')
              source.start(0)
              return true
            } catch {
              stopNeuralWebAudio()
            }
          }
        }

        if (speakGenRef.current !== myGen) return false

        const replayBlob = new Blob([ab], { type: mimeFromHeader })
        const url = URL.createObjectURL(replayBlob)
        objectUrlRef.current = url

        const audio = new Audio()
        try {
          audio.setAttribute('playsinline', '')
          audio.playsInline = true
        } catch {
          /* ignore */
        }
        audio.volume = 1
        audio.src = url
        audio.preload = 'auto'
        audioRef.current = audio

        const audioGen = myGen
        audio.onended = () => {
          cleanupAudio()
          if (speakGenRef.current === audioGen) setStatus('idle')
        }
        audio.onerror = () => {
          cleanupAudio()
          if (speakGenRef.current === audioGen) setStatus('idle')
        }

        try {
          audio.load()
          setStatus('playing')
          await audio.play()
          return speakGenRef.current === myGen
        } catch {
          cleanupAudio()
          return false
        }
      }

      try {
        const cached = prefetchedRef.current
        if (cached?.key === t && cached.ab.byteLength >= 64) {
          const ok = await tryPlayNeuralAb(cached.ab.slice(0), cached.mime)
          if (ok && speakGenRef.current === myGen) return
        }

        if (speakGenRef.current !== myGen) return

        const disk = getTtsNeuralCache(t)
        if (disk?.ab?.byteLength >= 64) {
          const ok = await tryPlayNeuralAb(disk.ab.slice(0), disk.mime)
          if (ok && speakGenRef.current === myGen) return
        }

        if (speakGenRef.current !== myGen) return

        abortRef.current = new AbortController()
        const fetched = await fetchNeuralTtsWithRetry(t, abortRef.current.signal)

        if (speakGenRef.current !== myGen) return

        if (fetched && fetched.ab.byteLength >= 64) {
          setTtsNeuralCache(t, fetched.ab.slice(0), fetched.mime)
          const ok = await tryPlayNeuralAb(fetched.ab.slice(0), fetched.mime)
          if (ok && speakGenRef.current === myGen) return
        }
      } catch (e) {
        if (e?.name === 'AbortError') {
          if (speakGenRef.current === myGen) setStatus('idle')
          return
        }
        cleanupAudio()
      }

      if (!window.speechSynthesis) {
        if (speakGenRef.current === myGen) setStatus('idle')
        return
      }

      const synth = window.speechSynthesis
      try {
        if (synth.paused) synth.resume()
      } catch {
        /* ignore */
      }

      const runSpeak = () => {
        if (speakGenRef.current !== myGen) return
        try {
          if (synth.paused) synth.resume()
        } catch {
          /* ignore */
        }

        void synth.getVoices()

        const u = new SpeechSynthesisUtterance(t)
        u.lang = 'en-US'
        u.rate = iosSpeechGestureOnly ? 0.9 : 0.86
        u.pitch = iosSpeechGestureOnly ? 1 : 1.04
        u.volume = 1

        const voice = pickVoiceForNarration(synth, { iosConservative: iosSpeechGestureOnly })
        if (voice) {
          u.voice = voice
        }

        u.onend = () => {
          if (speakGenRef.current === myGen) setStatus('idle')
        }
        u.onerror = () => {
          if (speakGenRef.current === myGen) setStatus('idle')
        }

        setStatus('playing')
        synth.speak(u)

        window.requestAnimationFrame(() => {
          try {
            if (synth.paused) synth.resume()
          } catch {
            /* ignore */
          }
        })
      }

      if (iosSpeechGestureOnly) {
        runSpeak()
      } else {
        queueMicrotask(runSpeak)
      }
    },
    [cleanupAudio, iosSpeechGestureOnly, stopNeuralWebAudio],
  )

  const togglePause = useCallback(() => {
    if (typeof window === 'undefined') return

    if (status === 'loading') {
      speakGenRef.current += 1
      cleanupAudio()
      setStatus('idle')
      return
    }

    if (bufferSourceRef.current && audioContextRef.current) {
      const ctx = audioContextRef.current
      if (ctx.state === 'running') {
        void ctx.suspend()
        setStatus('paused')
      } else if (ctx.state === 'suspended') {
        void ctx.resume()
        setStatus('playing')
      }
      return
    }

    const audio = audioRef.current
    if (audio) {
      if (audio.paused) {
        void audio.play()
        setStatus('playing')
      } else {
        audio.pause()
        setStatus('paused')
      }
      return
    }

    if (!window.speechSynthesis) return
    const synth = window.speechSynthesis
    if (!synth.speaking) return
    if (synth.paused) {
      synth.resume()
      setStatus('playing')
    } else {
      synth.pause()
      setStatus('paused')
    }
  }, [status, cleanupAudio])

  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort()
      prefetchedRef.current = null
      cleanupAudio()
      try {
        void audioContextRef.current?.close()
      } catch {
        /* ignore */
      }
      audioContextRef.current = null
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [cleanupAudio])

  return {
    speak,
    stop,
    togglePause,
    primePlaybackFromGesture,
    prefetchNarration,
    status,
    supported,
    iosSpeechGestureOnly,
  }
}
