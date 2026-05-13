import {
  findVoiceByUri,
  getSpeechVoicePreference,
} from './speechVoicePreference.js'

/**
 * Score voices for “less robotic” read-aloud when we must pick one (no default flag).
 * @param {SpeechSynthesisVoice} v
 */
function voiceNaturalnessScore(v) {
  const bundle = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase()
  let s = 0

  if (bundle.includes('enhanced')) s += 120
  if (bundle.includes('neural') || bundle.includes('wavenet')) s += 95
  if (bundle.includes('premium') || bundle.includes('natural')) s += 75
  if (bundle.includes('siri')) s += 45

  if (/(samantha|victoria|karen|moira|flo|tessa|serena|ava|allison|susan)/i.test(bundle)) s += 35
  if (/(zarvox|albert|cellos|bad news|whisper)/i.test(bundle)) s -= 40

  if (bundle.includes('compact') || bundle.includes('embed') || bundle.includes('low quality')) {
    s -= 55
  }

  if (/^en-us/i.test(v.lang)) s += 18
  else if (/^en-gb/i.test(v.lang)) s += 12
  else if (/^en/i.test(v.lang)) s += 8

  if (v.default) s += 4

  return s
}

function pickBestScoredEnglish(list) {
  let best = null
  let bestScore = -Infinity
  for (const v of list) {
    const sc = voiceNaturalnessScore(v)
    if (sc > bestScore) {
      bestScore = sc
      best = v
    }
  }
  return best
}

/**
 * Voice for Web Speech in this app. **Not** the same as macOS Accessibility “System voice” —
 * browsers use `speechSynthesis.getVoices()` and often ignore that setting.
 *
 * Priority: saved in-app choice → English default voice → any default → best-scored English.
 * @param {SpeechSynthesis} synth
 * @param {{ iosConservative: boolean }} opts
 */
export function pickVoiceForNarration(synth, { iosConservative }) {
  const voices = synth.getVoices()
  if (!voices.length) return null

  const prefUri = getSpeechVoicePreference()
  if (prefUri) {
    const chosen = findVoiceByUri(voices, prefUri)
    if (chosen) return chosen
  }

  const pool = voices.filter((v) => /^en/i.test(v.lang))
  const list = pool.length ? pool : voices

  const enDefault = list.find((v) => v.default && /^en/i.test(v.lang))
  if (enDefault) return enDefault

  const anyDefault = list.find((v) => v.default)
  if (anyDefault) return anyDefault

  const best = pickBestScoredEnglish(list)
  if (!best) return null

  if (iosConservative) {
    const bundle = `${best.name} ${best.voiceURI}`
    if (!/enhanced|neural|premium|wavenet|natural/i.test(bundle)) return null
  }

  return best
}
