const STORAGE_KEY = 'story-theater-speech-voice-uri'

export function getSpeechVoicePreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

/** @param {string} voiceURI empty = use browser default (do not set utterance.voice) */
export function setSpeechVoicePreference(voiceURI) {
  try {
    if (!voiceURI) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, voiceURI)
  } catch {
    /* private mode, etc. */
  }
}

/**
 * @param {SpeechSynthesisVoice[]} voices
 * @param {string} voiceURI
 */
export function findVoiceByUri(voices, voiceURI) {
  if (!voiceURI) return null
  return voices.find((v) => v.voiceURI === voiceURI) ?? null
}
