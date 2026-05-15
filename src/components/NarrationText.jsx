import { splitNarrationSentences } from '../lib/narrationSentences.js'

/**
 * Render narration as inline sentence spans so the currently-read sentence
 * can be highlighted while TTS plays.
 *
 * @param {{
 *   narration?: string | null,
 *   activeSentenceIndex?: number,
 *   className?: string,
 *   dimmed?: boolean,
 * }} props
 */
export function NarrationText({
  narration,
  activeSentenceIndex = -1,
  className = '',
  dimmed = false,
}) {
  const text = typeof narration === 'string' ? narration : ''
  if (!text.trim()) return null

  const sentences = splitNarrationSentences(text)
  if (sentences.length === 0) return text

  const baseClass = `font-serif text-left text-xl leading-8 text-stone-800 sm:text-2xl sm:leading-9${
    dimmed ? ' opacity-70' : ''
  } ${className}`.trim()

  return (
    <p className={baseClass}>
      {sentences.map((s, i) => {
        const isActive = i === activeSentenceIndex
        const cls = isActive
          ? 'rounded bg-amber-300/70 text-stone-900 shadow-[0_0_0_2px_rgba(217,119,6,0.18)] transition-colors duration-150'
          : 'transition-colors duration-150'
        return (
          <span key={`${s.start}-${s.end}`} className={cls}>
            {s.text}
          </span>
        )
      })}
    </p>
  )
}
