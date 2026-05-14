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

  const baseClass = `text-left text-xl leading-relaxed text-slate-100 sm:text-2xl sm:leading-relaxed${
    dimmed ? ' opacity-70' : ''
  } ${className}`.trim()

  return (
    <p className={baseClass}>
      {sentences.map((s, i) => {
        const isActive = i === activeSentenceIndex
        const cls = isActive
          ? 'rounded bg-amber-400/25 px-0.5 text-amber-50 shadow-[0_0_0_2px_rgba(251,191,36,0.25)] transition-colors duration-150'
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
