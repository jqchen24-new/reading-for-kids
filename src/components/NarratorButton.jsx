/**
 * Play / pause / stop controls for Web Speech narration.
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
        className="min-h-[48px] rounded-2xl border border-amber-400/50 bg-amber-400/15 px-5 py-2.5 text-base font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Preparing audio…' : 'Read aloud'}
      </button>
      <button
        type="button"
        onClick={onTogglePause}
        disabled={disabled || !canPauseOrCancel}
        className="min-h-[48px] rounded-2xl border border-slate-500 bg-slate-800/80 px-5 py-2.5 text-base font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Cancel' : status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={disabled || status === 'idle'}
        className="min-h-[48px] rounded-2xl border border-slate-600 bg-slate-900 px-5 py-2.5 text-base font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Stop
      </button>
    </div>
  )
}
