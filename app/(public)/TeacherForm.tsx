'use client'

import { useActionState, useState } from 'react'
import { submitRequest, type FormState } from './actions'
import SignOutButton from './SignOutButton'

const initialState: FormState = {}

export default function TeacherForm({ authedEmail }: { authedEmail: string | null }) {
  const [state, formAction, pending] = useActionState(submitRequest, initialState)
  const [isBlackout, setIsBlackout] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="flex items-start justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Request Time Off</h1>
          {authedEmail && <SignOutButton />}
        </div>

        {authedEmail && (
          <p className="mb-5 text-sm text-gray-600">
            Submitting as <span className="font-medium text-gray-900">{authedEmail}</span>.
            If this isn&apos;t you, sign out and log back in.
          </p>
        )}

        <form action={formAction} noValidate>

          {/* Full Name */}
          <div className="mb-5">
            <label htmlFor="teacher_name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="teacher_name"
              type="text"
              name="teacher_name"
              defaultValue={state.values?.teacher_name ?? ''}
              aria-describedby={state.errors?.teacher_name ? 'teacher_name-error' : undefined}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {state.errors?.teacher_name?.[0] && (
              <p id="teacher_name-error" className="mt-1 text-sm text-red-600">
                {state.errors.teacher_name[0]}
              </p>
            )}
          </div>

          {/* Work Email — read-only when authenticated; the server ignores any
              tampered value and uses the session email regardless. */}
          <div className="mb-5">
            <label htmlFor="teacher_email" className="block text-sm font-medium text-gray-700 mb-1">
              Work Email <span className="text-red-500">*</span>
            </label>
            <input
              id="teacher_email"
              type="email"
              name="teacher_email"
              defaultValue={authedEmail ?? state.values?.teacher_email ?? ''}
              readOnly={!!authedEmail}
              aria-describedby={state.errors?.teacher_email ? 'teacher_email-error' : undefined}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                authedEmail ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
              }`}
            />
            {state.errors?.teacher_email?.[0] && (
              <p id="teacher_email-error" className="mt-1 text-sm text-red-600">
                {state.errors.teacher_email[0]}
              </p>
            )}
          </div>

          {/* Start Date */}
          <div className="mb-5">
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="start_date"
              type="date"
              name="start_date"
              min={todayStr}
              defaultValue={state.values?.start_date ?? ''}
              aria-describedby={state.errors?.start_date ? 'start_date-error' : undefined}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onChange={(e) => setStartDate(e.target.value)}
            />
            {state.errors?.start_date?.[0] && (
              <p id="start_date-error" className="mt-1 text-sm text-red-600">
                {state.errors.start_date[0]}
              </p>
            )}
          </div>

          {/* End Date */}
          <div className="mb-5">
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="end_date"
              type="date"
              name="end_date"
              min={startDate || todayStr}
              defaultValue={state.values?.end_date ?? ''}
              aria-describedby={state.errors?.end_date ? 'end_date-error' : undefined}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {state.errors?.end_date?.[0] && (
              <p id="end_date-error" className="mt-1 text-sm text-red-600">
                {state.errors.end_date[0]}
              </p>
            )}
          </div>

          {/* Leave Type */}
          <div className="mb-5">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-1">
                Leave Type <span className="text-red-500">*</span>
              </legend>
              <div className="space-y-2 mt-1" aria-describedby={state.errors?.leave_type ? 'leave_type-error' : undefined}>
                {[
                  { value: 'sick', label: 'Sick Leave' },
                  { value: 'personal', label: 'Personal Leave' },
                  { value: 'vacation', label: 'Vacation' },
                  { value: 'bereavement', label: 'Bereavement Leave' },
                  { value: 'jury_duty', label: 'Jury Duty' },
                  { value: 'professional_development', label: 'Professional Development' },
                  { value: 'maternity_paternity', label: 'Maternity / Paternity Leave' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="leave_type"
                      value={value}
                      defaultChecked={state.values?.leave_type === value}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {state.errors?.leave_type?.[0] && (
                <p id="leave_type-error" className="mt-1 text-sm text-red-600">
                  {state.errors.leave_type[0]}
                </p>
              )}
            </fieldset>
          </div>

          {/* Blackout Period */}
          <div className="mb-5">
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-1">
                Blackout Period <span className="text-red-500">*</span>
              </legend>
              <p className="text-sm text-gray-500 mb-2">
                Does this request fall on a blackout period? Blackout dates are school periods when leave is not permitted (e.g., state testing weeks, spring break).
              </p>
              <div className="space-y-2" aria-describedby={state.errors?.is_blackout ? 'is_blackout-error' : undefined}>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="is_blackout"
                    value="true"
                    onChange={(e) => setIsBlackout(e.target.value)}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="is_blackout"
                    value="false"
                    onChange={(e) => setIsBlackout(e.target.value)}
                  />
                  No
                </label>
              </div>
              {isBlackout === 'true' && (
                <p className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                  Your request will be automatically denied. You&apos;ll receive a confirmation email.
                </p>
              )}
              {state.errors?.is_blackout?.[0] && (
                <p id="is_blackout-error" className="mt-1 text-sm text-red-600">
                  {state.errors.is_blackout[0]}
                </p>
              )}
            </fieldset>
          </div>

          {/* Reason (optional) */}
          <div className="mb-5">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason{' '}
              <span className="text-gray-400 text-sm font-normal">(optional)</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              rows={3}
              placeholder="Optional — provide any additional context"
              defaultValue={state.values?.reason ?? ''}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Server-level error */}
          {state.message && (
            <p className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {state.message}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Submitting...' : 'Submit Request'}
          </button>

        </form>
      </div>
    </main>
  )
}
