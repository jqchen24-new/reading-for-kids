import { NarratorButton } from './NarratorButton.jsx'

export function SceneDisplay({
  narration,
  sceneLabel,
  narratorStatus,
  speechSupported,
  iosSpeechGestureOnly,
  onNarratorReplay,
  onNarratorTogglePause,
  onNarratorStop,
  loading,
  illustrationUrl = null,
  illustrationStatus = 'idle',
  children,
}) {
  const showIllustrationSlot =
    illustrationStatus === 'loading' ||
    (illustrationStatus === 'ready' && Boolean(illustrationUrl))

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      {showIllustrationSlot && (
        <figure className="overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-900 shadow-lg">
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
                alt="Illustration for this scene"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
          </div>
        </figure>
      )}

      {sceneLabel && (
        <p className="text-center text-sm font-medium uppercase tracking-widest text-amber-300/80">
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
        <p className="rounded-xl border border-amber-500/45 bg-amber-950/50 px-4 py-3 text-center text-sm leading-snug text-amber-50">
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
        className="max-h-[min(50vh,420px)] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/70 p-6 shadow-inner"
        role="region"
        aria-live="polite"
        aria-label="Story narration"
      >
        {loading && narration?.trim() && (
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-amber-200/90">
            Writing the next part…
          </p>
        )}
        {!narration?.trim() && loading ? (
          <p className="text-center text-lg text-slate-400">Writing the next scene…</p>
        ) : (
          <p
            className={`text-left text-xl leading-relaxed text-slate-100 sm:text-2xl sm:leading-relaxed ${loading && narration?.trim() ? 'opacity-70' : ''}`}
          >
            {narration}
          </p>
        )}
      </div>

      {children}
    </div>
  )
}
