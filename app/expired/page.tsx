// app/expired/page.tsx
// Distinct from /invalid so an admin clicking an old link gets actionable copy
// ("ask the teacher to resubmit") rather than the generic "invalid" treatment.

export default function ExpiredPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full text-center">
        <div className="text-amber-500 text-5xl mb-4">&#9201;</div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          This Approval Link Has Expired
        </h1>

        <p className="text-sm text-gray-600 mb-2">
          Approval links are valid for a limited time after the request is
          submitted. This link is past that window.
        </p>
        <p className="text-sm text-gray-500">
          To take action, ask the teacher to resubmit the request — a fresh
          email with new links will be sent.
        </p>
      </div>
    </main>
  )
}
