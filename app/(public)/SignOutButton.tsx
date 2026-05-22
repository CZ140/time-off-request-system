'use client'

import { useTransition } from 'react'
import { signOut } from './sign-out-action'

export default function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={() => {
        startTransition(() => {
          signOut()
        })
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
    </form>
  )
}
