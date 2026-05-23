// Generic faculty-time-off wordmark. No school name, no glyph — text-only,
// keeping the visual identity in the typography rather than a logo mark.
export function Wordmark({ sublabel = 'Leave requests' }: { sublabel?: string }) {
  return (
    <div className="leading-tight">
      <div className="font-display text-[19px] text-ink">Faculty Time-Off</div>
      <div className="label-eyebrow mt-0.5 text-[9.5px]">{sublabel}</div>
    </div>
  )
}
