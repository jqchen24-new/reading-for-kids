export function ChoiceCards({ choices, onChoose, disabled }) {
  if (!choices?.length) return null

  return (
    <div className="grid w-full gap-4 sm:grid-cols-2">
      {choices.map((label, i) => (
        <button
          key={`${i}-${label}`}
          type="button"
          onClick={() => onChoose(label)}
          disabled={disabled}
          className="min-h-[64px] rounded-2xl border-2 border-amber-500/70 bg-amber-100 px-4 py-4 text-left font-serif text-lg font-semibold leading-snug text-stone-800 shadow-md shadow-stone-900/30 transition hover:border-amber-500 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[72px] sm:text-xl"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
