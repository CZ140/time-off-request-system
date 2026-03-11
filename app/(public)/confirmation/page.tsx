// app/(public)/confirmation/page.tsx
import Link from 'next/link'

type Props = {
  searchParams: Promise<{ status?: string }>
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { status } = await searchParams
  const isAutoDenied = status === 'auto_denied'

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-lg p-8 text-center">
        {isAutoDenied ? (
          <>
            <div className="text-amber-500 text-5xl mb-4">&#9888;</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Request Not Approved</h1>
            <p className="text-sm text-gray-600 mb-1">
              Your requested dates fall on a blackout period when leave is not permitted.
            </p>
            <p className="text-sm text-gray-600">
              A confirmation email has been sent to your inbox with further details.
            </p>
          </>
        ) : (
          <>
            <div className="text-green-500 text-5xl mb-4">&#10003;</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Request Received</h1>
            <p className="text-sm text-gray-600">
              Your request has been received. You&apos;ll hear back via email once it&apos;s been reviewed.
            </p>
          </>
        )}

        <Link href="/" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          Submit another request
        </Link>
      </div>
    </main>
  )
}
