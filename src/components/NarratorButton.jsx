/**
 * Play / pause / stop controls for narration.
 */
export function NarratorButton({ status, onReplay, onTogglePause, onStop, disabled }) {
  const isLoading = status === 'loading'
  const canPauseOrCancel = status === 'playing' || status === 'paused' || status === 'loading'

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={onReplay}
        disabled={disabled || isLoading}
        className="min-h-[48px] rounded-2xl border border-amber-400/70 bg-amber-400/90 px-5 py-2.5 text-base font-semibold text-stone-900 shadow-md shadow-amber-900/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Preparing audio…' : 'Read aloud'}
      </button>
      <button
        type="button"
        onClick={onTogglePause}
        disabled={disabled || !canPauseOrCancel}
        className="min-h-[48px] rounded-2xl border border-stone-500/70 bg-stone-700/80 px-5 py-2.5 text-base font-semibold text-stone-100 transition hover:bg-stone-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Cancel' : status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={disabled || status === 'idle'}
        className="min-h-[48px] rounded-2xl border border-stone-600/70 bg-stone-800/80 px-5 py-2.5 text-base font-semibold text-stone-200 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop
      </button>
    </div>
  )
}
