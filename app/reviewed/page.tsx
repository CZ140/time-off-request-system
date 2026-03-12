// app/reviewed/page.tsx

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  vacation: 'Vacation',
  bereavement: 'Bereavement Leave',
  jury_duty: 'Jury Duty',
  professional_development: 'Professional Development',
  maternity_paternity: 'Maternity / Paternity Leave',
}

type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function ReviewedPage({ searchParams }: Props) {
  const params = await searchParams

  const status = params.status
  const teacherName = params.teacher_name ?? '—'
  const startDate = params.start_date ? formatDate(params.start_date) : '—'
  const endDate = params.end_date ? formatDate(params.end_date) : '—'
  const leaveType = params.leave_type
    ? (LEAVE_TYPE_LABELS[params.leave_type] ?? params.leave_type)
    : '—'
  const reviewedBy = params.reviewed_by ?? '—'

  const isApproved = status === 'approved'
  const isDenied = status === 'denied'

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Request Already Reviewed
          </h1>
          <p className="text-sm text-gray-500">
            This leave request has already been reviewed. No further action is needed.
          </p>
        </div>

        {/* Status badge */}
        {(isApproved || isDenied) && (
          <div className="flex justify-center mb-6">
            <span
              className={
                isApproved
                  ? 'bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full'
                  : 'bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full'
              }
            >
              {isApproved ? 'Approved' : 'Denied'}
            </span>
          </div>
        )}

        {/* Request details */}
        <div className="border border-gray-100 rounded-md divide-y divide-gray-100">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Teacher Name</span>
            <span className="text-sm text-gray-900">{teacherName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Leave Type</span>
            <span className="text-sm text-gray-900">{leaveType}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Start Date</span>
            <span className="text-sm text-gray-900">{startDate}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">End Date</span>
            <span className="text-sm text-gray-900">{endDate}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Reviewed By</span>
            <span className="text-sm text-gray-900">{reviewedBy}</span>
          </div>
        </div>
      </div>
    </main>
  )
}
