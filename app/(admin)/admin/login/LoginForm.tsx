'use client'

import { useActionState } from 'react'
import { loginAdmin, type LoginState } from './actions'

const initialState: LoginState = {}

export default function LoginForm({ demoPassword }: { demoPassword?: string }) {
  const [state, formAction, pending] = useActionState(loginAdmin, initialState)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Admin Login</h1>

        {demoPassword && (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            Demo password: <span className="font-mono font-bold">{demoPassword}</span>
          </div>
        )}

        <form action={formAction}>
          <div className="mb-5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {state?.error && (
            <p className="mb-4 text-sm text-red-600" role="alert">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  )
}
