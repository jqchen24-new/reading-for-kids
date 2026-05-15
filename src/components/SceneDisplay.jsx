import { NarrationText } from './NarrationText.jsx'
import { NarratorButton } from './NarratorButton.jsx'

const NAV_BUTTON_CLASS =
  'rounded-xl border border-stone-500/70 bg-stone-800/80 px-4 py-2 text-sm font-semibold text-stone-100 transition hover:border-amber-300/70 hover:bg-stone-700 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40'

export function SceneDisplay({
  narration,
  sceneLabel,
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
  loading,
  illustrationUrl = null,
  illustrationStatus = 'idle',
  illustrationDisableCode = null,
  children,
}) {
  const showIllustrationSlot =
    illustrationStatus === 'loading' ||
    (illustrationStatus === 'ready' && Boolean(illustrationUrl))

  const showIllustrationHint =
    illustrationStatus === 'error' || illustrationStatus === 'off'

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
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

      {showIllustrationSlot && (
        <figure className="overflow-hidden rounded-md border border-stone-300 bg-amber-50 shadow-[0_18px_36px_-14px_rgba(28,25,23,0.55)]">
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
                alt="Illustration for this scene"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
          </div>
        </figure>
      )}

      {showIllustrationHint && (
        <p className="rounded-xl border border-stone-600/70 bg-stone-800/70 px-4 py-3 text-center text-sm text-stone-300">
          {illustrationStatus === 'error' ? (
            'Could not load a scene picture this time. The story and read-aloud still work — try the next scene or refresh.'
          ) : illustrationDisableCode === 'ILLUSTRATIONS_DISABLED' ? (
            <>
              Scene pictures are turned off for the server. Set{' '}
              <code className="text-amber-200">SCENE_ILLUSTRATIONS=1</code> (or{' '}
              <code className="text-amber-200">true</code>) in the{' '}
              <code className="text-amber-200">story-theater/.env</code> file, then{' '}
              <strong className="text-amber-100">restart</strong>{' '}
              <code className="text-amber-200">npm run dev</code>.
            </>
          ) : illustrationDisableCode === 'MISSING_GEMINI_KEY' ? (
            <>
              The server does not see a Gemini key for pictures. Add{' '}
              <code className="text-amber-200">GEMINI_API_KEY</code> to{' '}
              <code className="text-amber-200">story-theater/.env</code> (same key as TTS), then{' '}
              <strong className="text-amber-100">restart</strong>{' '}
              <code className="text-amber-200">npm run dev</code>.
            </>
          ) : (
            'Scene pictures are turned off on the server, or the picture key is missing. Check story-theater/.env and restart the dev server.'
          )}
        </p>
      )}

      {sceneLabel && (
        <p className="text-center text-sm font-medium uppercase tracking-[0.25em] text-amber-200/80">
          {sceneLabel}
        </p>
      )}

      {!speechSupported && (
        <p className="text-center text-sm text-amber-200/90">
          This browser does not support read-aloud (Web Speech). Try Chrome or Safari on a phone or
          tablet.
        </p>
      )}

      {speechSupported && iosSpeechGestureOnly && (
        <p className="rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-center text-sm leading-snug text-amber-50">
          <strong className="text-amber-200">iPhone &amp; iPad (Safari):</strong> speech usually only
          starts after you tap <strong>Read aloud</strong> (once per scene). If you hear nothing,
          turn the <strong>Ring/Silent</strong> switch off (no orange) and raise the{' '}
          <strong>volume</strong> buttons.
        </p>
      )}

      <NarratorButton
        status={narratorStatus}
        onReplay={onNarratorReplay}
        onTogglePause={onNarratorTogglePause}
        onStop={onNarratorStop}
        disabled={!speechSupported || !narration?.trim() || loading}
      />

      <div
        className="relative max-h-[min(50vh,420px)] w-full overflow-y-auto rounded-md bg-amber-50 px-6 py-7 shadow-[0_25px_45px_-12px_rgba(28,25,23,0.6)] ring-1 ring-stone-300 sm:px-8 sm:py-8"
        role="region"
        aria-live="polite"
        aria-label="Story narration"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-md bg-gradient-to-br from-white/45 via-transparent to-stone-200/45"
          aria-hidden
        />
        <div className="relative">
          {loading && narration?.trim() && (
            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
              Writing the next part…
            </p>
          )}
          {!narration?.trim() && loading ? (
            <p className="text-center text-lg text-stone-500">Writing the next scene…</p>
          ) : (
            <NarrationText
              narration={narration}
              activeSentenceIndex={narratorActiveSentenceIndex}
              dimmed={Boolean(loading && narration?.trim())}
            />
          )}
        </div>
      </div>

      {children}
    </div>
  )
}
