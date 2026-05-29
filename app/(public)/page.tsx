'use client'

import { useActionState, useState } from 'react'
import { submitRequest, type FormState } from './actions'
import { Wordmark } from '@/app/_components/Wordmark'
import { CalIcon, CheckIcon } from '@/app/_components/icons'

const initialState: FormState = {}

// Parsed once at module load — the env var is inlined at build time.
// UX hint only: the server-side ALLOWED_EMAIL_DOMAINS check in actions.ts is
// the authoritative gate. If this hint is missing or wrong, submissions still
// pass/fail correctly server-side.
const ALLOWED_DOMAINS_HINT = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS_HINT ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

function isDomainHintViolation(email: string): boolean {
  if (ALLOWED_DOMAINS_HINT.length === 0) return false
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return false
  const domain = email.slice(at + 1).trim().toLowerCase()
  return !ALLOWED_DOMAINS_HINT.includes(domain)
}

// Form labels are kept short so all 9 options fit on a single line in the
// 3-column grid. The full canonical labels live in LEAVE_TYPE_LABELS
// (lib/email/utils.ts) and are used everywhere else (admin dashboard, emails).
const LEAVE_TYPES: { value: string; label: string }[] = [
  { value: 'sick', label: 'Sick' },
  { value: 'half_day_am', label: 'Half day (AM)' },
  { value: 'half_day_pm', label: 'Half day (PM)' },
  { value: 'personal', label: 'Personal' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'bereavement', label: 'Bereavement' },
  { value: 'jury_duty', label: 'Jury duty' },
  { value: 'professional_development', label: 'Prof. dev.' },
  { value: 'maternity_paternity', label: 'Parental' },
]

export default function TeacherFormPage() {
  const [state, formAction, pending] = useActionState(submitRequest, initialState)
  const [isBlockout, setIsBlockout] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>(state.values?.start_date ?? '')
  const [emailHint, setEmailHint] = useState<string | null>(null)
  const [leaveType, setLeaveType] = useState<string>(state.values?.leave_type ?? '')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const hintDomainList =
    ALLOWED_DOMAINS_HINT.length === 1
      ? `@${ALLOWED_DOMAINS_HINT[0]}`
      : ALLOWED_DOMAINS_HINT.map((d) => `@${d}`).join(' or ')

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark />
        <div className="label-eyebrow hidden sm:block">Faculty time-off</div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-10 sm:px-14 lg:grid-cols-[1fr_320px] lg:gap-14 lg:pt-12">
        <section>
          <div className="label-eyebrow mb-3 text-moss">● A request for time away</div>
          <h1 className="font-display text-[44px] leading-[1.02] tracking-tight text-ink sm:text-[56px] lg:text-[64px]">
            Tell us when you
            <br />
            <em className="italic">need to be out</em>.
          </h1>

          <form
            action={formAction}
            noValidate
            className="mt-8 rounded-md border border-rule bg-card p-6 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)] sm:p-9"
          >
            {/* Section 1 — Who you are */}
            <Section num="01" title="Who you are">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="teacher_name" error={state.errors?.teacher_name?.[0]}>
                  <input
                    id="teacher_name"
                    type="text"
                    name="teacher_name"
                    defaultValue={state.values?.teacher_name ?? ''}
                    aria-describedby={state.errors?.teacher_name ? 'teacher_name-error' : undefined}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Work email"
                  htmlFor="teacher_email"
                  error={state.errors?.teacher_email?.[0]}
                  hint={!state.errors?.teacher_email ? emailHint : null}
                >
                  <input
                    id="teacher_email"
                    type="email"
                    name="teacher_email"
                    defaultValue={state.values?.teacher_email ?? ''}
                    aria-describedby={
                      state.errors?.teacher_email
                        ? 'teacher_email-error'
                        : emailHint
                          ? 'teacher_email-hint'
                          : undefined
                    }
                    onBlur={(e) => {
                      setEmailHint(
                        isDomainHintViolation(e.target.value)
                          ? `This system is only for ${hintDomainList} emails.`
                          : null,
                      )
                    }}
                    onChange={() => {
                      if (emailHint) setEmailHint(null)
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            {/* Section 2 — The dates */}
            <Section num="02" title="The dates">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start" htmlFor="start_date" error={state.errors?.start_date?.[0]} icon={<CalIcon size={15} className="text-ink-2" />}>
                  <input
                    id="start_date"
                    type="date"
                    name="start_date"
                    min={todayStr}
                    defaultValue={state.values?.start_date ?? ''}
                    aria-describedby={state.errors?.start_date ? 'start_date-error' : undefined}
                    className={dateInputClass}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </Field>
                <Field label="End" htmlFor="end_date" error={state.errors?.end_date?.[0]} icon={<CalIcon size={15} className="text-ink-2" />}>
                  <input
                    id="end_date"
                    type="date"
                    name="end_date"
                    min={startDate || todayStr}
                    defaultValue={state.values?.end_date ?? ''}
                    aria-describedby={state.errors?.end_date ? 'end_date-error' : undefined}
                    className={dateInputClass}
                  />
                </Field>
              </div>
            </Section>

            {/* Section 3 — Leave type */}
            <Section num="03" title="The kind of leave">
              <fieldset>
                <legend className="sr-only">Leave type</legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-describedby={state.errors?.leave_type ? 'leave_type-error' : undefined}>
                  {LEAVE_TYPES.map(({ value, label }) => {
                    const checked = leaveType === value
                    return (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-center justify-between rounded-sm border px-4 py-3 text-sm font-semibold transition-colors ${
                          checked
                            ? 'border-moss bg-moss text-cream'
                            : 'border-rule bg-card text-ink hover:bg-cream-alt'
                        }`}
                      >
                        <input
                          type="radio"
                          name="leave_type"
                          value={value}
                          checked={checked}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="sr-only"
                        />
                        <span>{label}</span>
                        {checked && <CheckIcon size={14} className="text-cream" />}
                      </label>
                    )
                  })}
                </div>
                {state.errors?.leave_type?.[0] && (
                  <p id="leave_type-error" className="mt-2 text-sm text-oxblood">
                    {state.errors.leave_type[0]}
                  </p>
                )}
              </fieldset>
            </Section>

            {/* Section 4 — Blockout question */}
            <Section
              num="04"
              title="Is this during a blockout period?"
              sub="Testing weeks, finals, graduation."
            >
              <fieldset>
                <legend className="sr-only">Blockout period</legend>
                <div className="flex flex-wrap gap-2.5" aria-describedby={state.errors?.is_blockout ? 'is_blockout-error' : undefined}>
                  <BlockoutToggle name="is_blockout" value="false" label="No, dates are clear" current={isBlockout} onChange={setIsBlockout} />
                  <BlockoutToggle name="is_blockout" value="true" label="Yes, dates overlap" current={isBlockout} onChange={setIsBlockout} />
                </div>
                {isBlockout === 'true' && (
                  <p className="mt-3 rounded-sm border border-bark/40 bg-butter/40 px-3 py-2 text-sm text-bark">
                    Heads up — requests on a blockout period are auto-denied. You&apos;ll get a confirmation email.
                  </p>
                )}
                {state.errors?.is_blockout?.[0] && (
                  <p id="is_blockout-error" className="mt-2 text-sm text-oxblood">
                    {state.errors.is_blockout[0]}
                  </p>
                )}
              </fieldset>
            </Section>

            {/* Section 5 — Reason */}
            <Section
              num="05"
              title="Anything the principal should know?"
              sub="Optional. A sentence is plenty."
            >
              <textarea
                id="reason"
                name="reason"
                rows={3}
                placeholder="Sub plans, context, anything that helps the call…"
                defaultValue={state.values?.reason ?? ''}
                className="w-full resize-y rounded-sm border border-rule bg-cream px-4 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </Section>

            {/* Server-level error */}
            {state.message && (
              <p className="mb-4 rounded-sm border border-oxblood/30 bg-oxblood/10 px-4 py-3 text-sm text-oxblood">
                {state.message}
              </p>
            )}

            {/* Submit row */}
            <div className="flex flex-col-reverse items-stretch justify-between gap-4 border-t border-dashed border-rule pt-6 sm:flex-row sm:items-center">
              <div className="text-[13px] text-ink-3">
                Submitted requests can&apos;t be edited — only withdrawn.
              </div>
              <button
                type="submit"
                disabled={pending}
                className="rounded-sm bg-moss px-6 py-3.5 text-[15px] font-bold tracking-wide text-cream transition-colors hover:bg-moss-alt focus:outline-none focus:ring-2 focus:ring-moss/40 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send request →'}
              </button>
            </div>
          </form>
        </section>

        {/* Sidebar — How this works */}
        <aside className="lg:pt-2">
          <div className="label-eyebrow mb-4">How this works</div>
          <ol className="grid gap-3.5">
            {[
              ['You send the form', "It lands in the principal's inbox right away."],
              ['She reviews it', 'Approve / Deny links are right in the email.'],
              ['You get a reply', 'Usually within a few hours. Always by end of next day.'],
            ].map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[28px_1fr] gap-2.5">
                <span className="font-display text-[26px] italic leading-none text-moss">{i + 1}.</span>
                <div>
                  <div className="text-sm font-bold text-ink">{t}</div>
                  <div className="mt-0.5 text-[13px] text-ink-2">{d}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-7 rounded-sm border border-dashed border-rule p-4 text-[13px]">
            <div className="label-eyebrow mb-2 text-oxblood">A note on accuracy</div>
            <p className="text-ink-2">
              The blockout check is enforced server-side. Even if you select &ldquo;dates are clear,&rdquo; the system will still verify against the school calendar.
            </p>
          </div>
        </aside>
      </div>
    </main>
  )
}

// ---- Small composable bits ----

const inputClass =
  'w-full rounded-sm border border-rule bg-cream px-4 py-3 text-[15px] font-semibold text-ink placeholder:text-ink-3 focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30'

// Native date input needs slightly less inner padding to feel balanced against
// the browser's calendar glyph; otherwise it visually drifts higher than text inputs.
const dateInputClass = inputClass

function Section({
  num,
  title,
  sub,
  children,
}: {
  num: string
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 border-b border-dashed border-rule pb-6 last:border-b-0 last:pb-0">
      <div className="mb-4 flex items-baseline gap-3.5">
        <span className="font-display text-[28px] italic leading-none text-moss">{num}</span>
        <div>
          <div className="font-display text-[22px] leading-tight text-ink">{title}</div>
          {sub && <div className="mt-0.5 text-[13px] text-ink-3">{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  icon,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string | null
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label-eyebrow mb-2 block">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            {icon}
          </span>
        )}
        <div className={icon ? '[&_input]:pl-10' : ''}>{children}</div>
      </div>
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm text-oxblood">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-bark">
          {hint}
        </p>
      )}
    </div>
  )
}

function BlockoutToggle({
  name,
  value,
  label,
  current,
  onChange,
}: {
  name: string
  value: string
  label: string
  current: string | null
  onChange: (v: string) => void
}) {
  const on = current === value
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-sm border px-4 py-3 text-sm font-bold transition-colors ${
        on ? 'border-moss bg-moss text-cream' : 'border-rule bg-card text-ink hover:bg-cream-alt'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={on}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
          on ? 'border-cream' : 'border-rule'
        }`}
      >
        {on && <span className="block h-1.5 w-1.5 rounded-full bg-cream" />}
      </span>
      {label}
    </label>
  )
}
