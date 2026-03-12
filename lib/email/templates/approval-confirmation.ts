// lib/email/templates/approval-confirmation.ts
// Minimal approval confirmation email sent to the teacher.
// No args required — approval email is intentionally brief.
// Pure function — no server-side I/O. No 'server-only' import needed.

export function approvalConfirmationTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Time-Off Request — Approved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #374151; line-height: 1.6;">

    <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">

      <p style="margin: 0 0 16px 0; font-size: 16px;">Good news!</p>

      <p style="margin: 0 0 16px 0; font-size: 16px;">
        Your time-off request has been approved.
      </p>

      <p style="margin: 0; font-size: 16px;">
        Warm regards,<br />
        <strong>School Administration</strong>
      </p>

    </div>

  </div>
</body>
</html>`
}
