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
          className="min-h-[64px] rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 px-4 py-4 text-left text-lg font-semibold leading-snug text-amber-50 transition hover:border-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-[72px] sm:text-xl"
        >
          {label}
        </button>
      ))}
    </div>
  )
}
