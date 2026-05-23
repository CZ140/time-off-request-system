import { CheckIcon } from './icons'

// Generic faculty-time-off wordmark. No school name — keeping it brand-neutral
// per the chosen design direction. The moss circle + check glyph reads as the
// "decision/request system" without using letterforms.
export function Wordmark({ sublabel = 'Leave requests' }: { sublabel?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-moss text-cream">
        <CheckIcon size={14} strokeWidth={2} />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[19px] text-ink">Faculty Time-Off</div>
        <div className="label-eyebrow mt-0.5 text-[9.5px]">{sublabel}</div>
      </div>
    </div>
  )
}
