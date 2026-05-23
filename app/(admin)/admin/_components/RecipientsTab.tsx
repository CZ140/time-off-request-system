'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'
import {
  addAdminRecipient,
  removeAdminRecipient,
  type AdminRecipientState,
} from '../actions'

type AdminRecipientRow = Database['public']['Tables']['admin_recipients']['Row']

export default function RecipientsTab({ recipients }: { recipients: AdminRecipientRow[] }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [isRemoving, startRemove] = useTransition()
  const [formKey, setFormKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)

  const [addState, addAction, addPending] = useActionState(
    async (prev: AdminRecipientState | null, formData: FormData) => {
      const result = await addAdminRecipient(prev, formData)
      if (result?.success) {
        setFormKey((k) => k + 1)
        setAddOpen(false)
        router.refresh()
      }
      return result
    },
    null,
  )

  function handleRemove(id: string) {
    startRemove(async () => {
      const result = await removeAdminRecipient(id)
      if (result.error) {
        setRemoveError(result.error)
        setConfirmId(null)
        return
      }
      setRemoveError(null)
      setConfirmId(null)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink sm:text-[40px]">
            Who gets <em className="italic">notified</em>.
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
            Each address on this list receives an email — with its own personal Approve / Deny links — every time a
            teacher submits a request. Add a backup so you’re not single-point-of-failure.
          </p>
        </div>
        {!addOpen && (
          <button
            onClick={() => setAddOpen(true)}
            className="self-start rounded-sm bg-moss px-4 py-2.5 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt sm:self-auto"
          >
            + Add recipient
          </button>
        )}
      </div>

      {addOpen && (
        <form
          key={formKey}
          action={addAction}
          className="mb-6 rounded-md border border-dashed border-rule bg-card p-5"
        >
          <div className="label-eyebrow mb-3 text-moss">● New recipient</div>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <div>
              <label htmlFor="recipient-email" className="label-eyebrow mb-1.5 block">
                Email
              </label>
              <input
                id="recipient-email"
                name="email"
                type="email"
                placeholder="principal@school.edu"
                required
                autoComplete="off"
                className="w-full rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </div>
            <div>
              <label htmlFor="recipient-label" className="label-eyebrow mb-1.5 block">
                Label <span className="text-ink-3 normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="recipient-label"
                name="label"
                type="text"
                placeholder="e.g. Principal"
                className="w-full rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={addPending}
              className="rounded-sm bg-moss px-4 py-2 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addPending ? 'Adding…' : 'Add recipient'}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            {addState?.error && <p className="text-sm text-oxblood">{addState.error}</p>}
          </div>
        </form>
      )}

      {removeError && (
        <p className="mb-4 rounded-sm border border-oxblood/30 bg-oxblood/10 px-3 py-2 text-sm text-oxblood">
          {removeError}
        </p>
      )}

      {recipients.length === 0 ? (
        <div className="rounded-md border border-dashed border-oxblood/40 bg-oxblood/5 p-8 text-center">
          <div className="label-eyebrow mb-1 text-oxblood">Nobody listening</div>
          <p className="text-[15px] text-ink-2">
            No recipients are configured. Until you add at least one, teacher submissions will fail with a clear error
            message rather than silently going nowhere.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {recipients.map((r) => {
            const isOnlyRow = recipients.length === 1
            const isConfirming = confirmId === r.id
            return (
              <li
                key={r.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-md border border-rule bg-card p-5"
              >
                <div>
                  {r.label && (
                    <div className="font-display text-[20px] leading-tight text-ink">{r.label}</div>
                  )}
                  <a
                    href={`mailto:${r.email}`}
                    className={`break-all text-[14px] underline decoration-dotted underline-offset-2 hover:text-moss ${
                      r.label ? 'mt-0.5 text-ink-2' : 'font-semibold text-ink'
                    }`}
                  >
                    {r.email}
                  </a>
                </div>
                <div>
                  {isConfirming ? (
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemove(r.id)}
                        disabled={isRemoving}
                        className="label-eyebrow text-oxblood transition-colors hover:opacity-70 disabled:opacity-40"
                      >
                        {isRemoving ? 'Removing…' : 'Confirm?'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={isRemoving}
                        className="label-eyebrow text-ink-3 transition-colors hover:text-ink-2 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : isOnlyRow ? (
                    <span
                      className="label-eyebrow cursor-not-allowed text-ink-3/50"
                      title="Add another recipient before removing this one."
                    >
                      Remove
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(r.id)}
                      className="label-eyebrow text-ink-3 transition-colors hover:text-oxblood"
                      aria-label={`Remove ${r.email}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
