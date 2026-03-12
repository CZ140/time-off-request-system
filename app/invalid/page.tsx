// app/invalid/page.tsx

export default function InvalidPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full text-center">
        {/* Icon */}
        <div className="text-amber-500 text-5xl mb-4">&#9888;</div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Invalid Approval Link
        </h1>

        {/* Explanation */}
        <p className="text-sm text-gray-600 mb-2">
          This approval link is invalid, has expired, or has already been used.
        </p>
        <p className="text-sm text-gray-500">
          If you received this link in an email, it may have been corrupted or the
          request no longer exists. You can safely close this tab.
        </p>
      </div>
    </main>
  )
}
