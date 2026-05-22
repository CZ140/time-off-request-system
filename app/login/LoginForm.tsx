'use client'

import { useActionState } from 'react'
import { sendMagicLink, type LoginState } from './actions'

const initialState: LoginState = {}

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState)

  if (state.sent) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Check your email</h1>
        <p className="text-sm text-gray-600">
          We sent a magic-link to <span className="font-medium text-gray-900">{state.email}</span>.
          Click the link in that email to finish signing in. The link is valid for 24 hours.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Teacher Login</h1>
      <p className="text-sm text-gray-600 mb-6">
        Enter your school email and we&apos;ll send you a one-time login link.
      </p>

      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <div className="mb-5">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            School email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {state.error && (
          <p className="mb-4 text-sm text-red-600" role="alert">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    </div>
  )
}
