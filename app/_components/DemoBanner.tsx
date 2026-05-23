// Cream/butter demo banner — unmissable but not panic-inducing, per the brief.
// Keeps the existing admin-login hint inline (useful for portfolio visitors).
export function DemoBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-bark/40 bg-butter px-7 py-2 text-[13px] text-bark sm:gap-4">
      <span className="label-eyebrow shrink-0 rounded-sm border border-bark px-2 py-[2px] text-[10px] text-bark">
        Demo Mode
      </span>
      <span className="hidden sm:inline">
        <strong className="font-semibold">Heads up —</strong> nothing submitted here goes anywhere.
        This is a sandbox copy of the system.
      </span>
      <span className="inline sm:hidden">
        <strong className="font-semibold">Heads up —</strong> sandbox copy.
      </span>
      <span className="ml-auto hidden text-[12px] md:inline">
        Admin login: <span className="font-mono font-bold">demo</span> at{' '}
        <a href="/admin" className="underline underline-offset-2 hover:no-underline">/admin</a>
      </span>
    </div>
  )
}
