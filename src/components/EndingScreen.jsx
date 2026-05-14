import { NarratorButton } from './NarratorButton.jsx'

export function EndingScreen({
  narration,
  narratorStatus,
  speechSupported,
  iosSpeechGestureOnly,
  onNarratorReplay,
  onNarratorTogglePause,
  onNarratorStop,
  onGoHome,
  onGoStoryBack,
  onGoStoryForward,
  canGoStoryBack = false,
  canGoStoryForward = false,
  storyNavDisabled = false,
  onPlayAgain,
  illustrationUrl = null,
  illustrationStatus = 'idle',
  illustrationDisableCode = null,
}) {
  const showIllustrationSlot =
    illustrationStatus === 'loading' ||
    (illustrationStatus === 'ready' && Boolean(illustrationUrl))

  const showIllustrationHint =
    illustrationStatus === 'error' || illustrationStatus === 'off'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 px-4 py-10">
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onGoHome}
            className="rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:bg-slate-800/80 hover:text-amber-100"
          >
            ← Home
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoStoryBack}
              disabled={!canGoStoryBack || storyNavDisabled}
              className="rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:bg-slate-800/80 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous scene"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={onGoStoryForward}
              disabled={!canGoStoryForward || storyNavDisabled}
              className="rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-400/60 hover:bg-slate-800/80 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next scene"
            >
              Next →
            </button>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300/90">The end</p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">What a story!</h2>
        </div>
      </div>

      {showIllustrationSlot && (
        <figure className="w-full overflow-hidden rounded-2xl border border-slate-600/90 bg-slate-900 shadow-lg">
          <div className="relative aspect-[16/9] w-full bg-slate-950">
            {illustrationStatus === 'loading' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                <span
                  className="inline-block size-8 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400"
                  aria-hidden
                />
                <span>Drawing this scene…</span>
              </div>
            ) : (
              <img
                src={illustrationUrl}
                alt="Illustration for the ending"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
          </div>
        </figure>
      )}

      {showIllustrationHint && (
        <p className="w-full rounded-xl border border-slate-600/80 bg-slate-900/60 px-4 py-3 text-center text-sm text-slate-400">
          {illustrationStatus === 'error' ? (
            'Could not load a scene picture this time. The story and read-aloud still work — try refreshing.'
          ) : illustrationDisableCode === 'ILLUSTRATIONS_DISABLED' ? (
            <>
              Scene pictures are turned off for the server. Set{' '}
              <code className="text-slate-300">SCENE_ILLUSTRATIONS=1</code> (or{' '}
              <code className="text-slate-300">true</code>) in <code className="text-slate-300">story-theater/.env</code>, then{' '}
              <strong className="text-slate-300">restart</strong> <code className="text-slate-300">npm run dev</code>.
            </>
          ) : illustrationDisableCode === 'MISSING_GEMINI_KEY' ? (
            <>
              The server does not see <code className="text-slate-300">GEMINI_API_KEY</code> for pictures. Add it to{' '}
              <code className="text-slate-300">story-theater/.env</code>, then <strong className="text-slate-300">restart</strong>{' '}
              <code className="text-slate-300">npm run dev</code>.
            </>
          ) : (
            'Scene pictures are turned off on the server, or the picture key is missing. Check story-theater/.env and restart the dev server.'
          )}
        </p>
      )}

      <div
        className="w-full max-h-[min(45vh,380px)] overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900/80 p-6 text-left text-xl leading-relaxed text-slate-100 sm:text-2xl"
        role="region"
        aria-live="polite"
      >
        {narration}
      </div>

      {!speechSupported && (
        <p className="text-center text-sm text-amber-200/90">
          Read-aloud is not available in this browser.
        </p>
      )}

      {speechSupported && iosSpeechGestureOnly && (
        <p className="max-w-lg rounded-xl border border-amber-500/45 bg-amber-950/50 px-4 py-3 text-center text-sm leading-snug text-amber-50">
          On iPhone &amp; iPad, tap <strong>Read aloud</strong> to hear the ending. Check the Ring/Silent
          switch and volume if it&apos;s quiet.
        </p>
      )}

      <NarratorButton
        status={narratorStatus}
        onReplay={onNarratorReplay}
        onTogglePause={onNarratorTogglePause}
        onStop={onNarratorStop}
        disabled={!speechSupported || !narration?.trim()}
      />

      <button
        type="button"
        onClick={onPlayAgain}
        className="min-h-[56px] w-full max-w-md rounded-2xl bg-amber-400 px-6 py-3 text-xl font-bold text-slate-950 shadow-lg transition hover:bg-amber-300 sm:w-auto sm:min-w-[280px]"
      >
        Play again
      </button>
    </div>
  )
}
