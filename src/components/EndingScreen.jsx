import { NarrationText } from './NarrationText.jsx'
import { NarratorButton } from './NarratorButton.jsx'

const NAV_BUTTON_CLASS =
  'rounded-xl border border-stone-500/70 bg-stone-800/80 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:border-amber-300/70 hover:bg-stone-700 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40'

export function EndingScreen({
  narration,
  narratorStatus,
  narratorActiveSentenceIndex = -1,
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
          <button type="button" onClick={onGoHome} className={NAV_BUTTON_CLASS}>
            ← Home
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoStoryBack}
              disabled={!canGoStoryBack || storyNavDisabled}
              className={NAV_BUTTON_CLASS}
              aria-label="Previous scene"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={onGoStoryForward}
              disabled={!canGoStoryForward || storyNavDisabled}
              className={NAV_BUTTON_CLASS}
              aria-label="Next scene"
            >
              Next →
            </button>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-300/90">The end</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-amber-50 sm:text-4xl">
            What a story!
          </h2>
        </div>
      </div>

      {showIllustrationSlot && (
        <figure className="w-full overflow-hidden rounded-md border border-stone-300 bg-amber-50 shadow-[0_18px_36px_-14px_rgba(28,25,23,0.55)]">
          <div className="relative aspect-[16/9] w-full bg-stone-200">
            {illustrationStatus === 'loading' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-stone-500">
                <span
                  className="inline-block size-8 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-500"
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
        <p className="w-full rounded-xl border border-stone-600/70 bg-stone-800/70 px-4 py-3 text-center text-sm text-stone-300">
          {illustrationStatus === 'error' ? (
            'Could not load a scene picture this time. The story and read-aloud still work — try refreshing.'
          ) : illustrationDisableCode === 'ILLUSTRATIONS_DISABLED' ? (
            <>
              Scene pictures are turned off for the server. Set{' '}
              <code className="text-amber-200">SCENE_ILLUSTRATIONS=1</code> (or{' '}
              <code className="text-amber-200">true</code>) in{' '}
              <code className="text-amber-200">story-theater/.env</code>, then{' '}
              <strong className="text-amber-100">restart</strong>{' '}
              <code className="text-amber-200">npm run dev</code>.
            </>
          ) : illustrationDisableCode === 'MISSING_GEMINI_KEY' ? (
            <>
              The server does not see <code className="text-amber-200">GEMINI_API_KEY</code> for
              pictures. Add it to <code className="text-amber-200">story-theater/.env</code>, then{' '}
              <strong className="text-amber-100">restart</strong>{' '}
              <code className="text-amber-200">npm run dev</code>.
            </>
          ) : (
            'Scene pictures are turned off on the server, or the picture key is missing. Check story-theater/.env and restart the dev server.'
          )}
        </p>
      )}

      <div
        className="relative w-full max-h-[min(45vh,380px)] overflow-y-auto rounded-md bg-amber-50 px-6 py-7 shadow-[0_25px_45px_-12px_rgba(28,25,23,0.6)] ring-1 ring-stone-300 sm:px-8 sm:py-8"
        role="region"
        aria-live="polite"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-br from-white/45 via-transparent to-stone-200/45"
          aria-hidden
        />
        <div className="relative">
          <NarrationText
            narration={narration}
            activeSentenceIndex={narratorActiveSentenceIndex}
          />
        </div>
      </div>

      {!speechSupported && (
        <p className="text-center text-sm text-amber-200/90">
          Read-aloud is not available in this browser.
        </p>
      )}

      {speechSupported && iosSpeechGestureOnly && (
        <p className="max-w-lg rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-center text-sm leading-snug text-amber-50">
          On iPhone &amp; iPad, tap <strong>Read aloud</strong> to hear the ending. Check the
          Ring/Silent switch and volume if it&apos;s quiet.
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
        className="min-h-[56px] w-full max-w-md rounded-2xl bg-amber-400 px-6 py-3 text-xl font-bold text-stone-900 shadow-lg transition hover:bg-amber-300 sm:w-auto sm:min-w-[280px]"
      >
        Play again
      </button>
    </div>
  )
}
