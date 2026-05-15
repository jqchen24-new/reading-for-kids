const GENRES = [
  { id: 'Adventure', label: 'Adventure' },
  { id: 'Magic', label: 'Magic' },
  { id: 'Animals', label: 'Animals' },
  { id: 'Space', label: 'Space' },
  { id: 'Mystery', label: 'Mystery' },
  { id: 'Comedy', label: 'Silly comedy' },
  { id: 'Fantasy', label: 'Fantasy' },
  { id: 'Ocean', label: 'Ocean' },
  { id: 'Fairytale', label: 'Fairytale' },
  { id: 'Superheroes', label: 'Superheroes' },
  { id: 'Dinosaurs', label: 'Dinosaurs' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Robots', label: 'Robots' },
  { id: 'Woodland', label: 'Woodland' },
  { id: 'Pirates', label: 'Pirates' },
  { id: 'TimeTravel', label: 'Time travel' },
]

const PILL_BASE =
  'min-h-[52px] rounded-2xl border-2 px-3 py-3 text-base font-semibold transition'
const PILL_SELECTED =
  'border-amber-400 bg-amber-300/90 text-stone-900 shadow-lg shadow-amber-900/30'
const PILL_UNSELECTED =
  'border-stone-500/70 bg-stone-800/70 text-stone-100 hover:border-amber-300/60 hover:bg-stone-700/80'

export function SetupScreen({
  genre,
  onGenreChange,
  heroName,
  onHeroNameChange,
  heroGender,
  onHeroGenderChange,
  onStart,
  loading,
  error,
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300/90">
          Interactive Story Theater
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-amber-50 sm:text-4xl">
          Start your story
        </h1>
        <p className="mt-3 text-lg text-stone-300">
          Pick a world and your hero&apos;s name. We&apos;ll read everything aloud and match art to
          your hero.
        </p>
      </header>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-amber-50">Genre</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {GENRES.map(({ id, label }) => {
            const selected = genre === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onGenreChange(id)}
                className={`${PILL_BASE} ${selected ? PILL_SELECTED : PILL_UNSELECTED}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="hero-name" className="text-lg font-semibold text-amber-50">
          Hero name
        </label>
        <input
          id="hero-name"
          type="text"
          maxLength={40}
          value={heroName}
          onChange={(e) => onHeroNameChange(e.target.value)}
          placeholder="Your name"
          autoComplete="given-name"
          className="w-full min-h-[52px] rounded-2xl border-2 border-stone-500/70 bg-stone-800/70 px-4 text-lg text-amber-50 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none"
        />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-amber-50">Hero in pictures &amp; story</legend>
        <p className="text-sm text-stone-300">
          Keeps pronouns in the text aligned with how your hero is drawn.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { id: 'girl', label: 'Girl (she/her)' },
            { id: 'boy', label: 'Boy (he/him)' },
            { id: 'neutral', label: 'They/them' },
          ].map(({ id, label }) => {
            const selected = heroGender === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => onHeroGenderChange(id)}
                className={`${PILL_BASE} ${selected ? PILL_SELECTED : PILL_UNSELECTED}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {error && (
        <p
          className="rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-3 text-center text-base text-red-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className="min-h-[56px] w-full rounded-2xl bg-amber-400 px-6 py-3 text-xl font-bold text-stone-900 shadow-lg transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? 'Starting story…' : 'Begin story'}
      </button>
    </div>
  )
}
