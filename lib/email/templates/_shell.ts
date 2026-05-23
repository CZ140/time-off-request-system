// lib/email/templates/_shell.ts
// Shared cream-paper Schoolhouse shell used by every outbound email template.
//
// Email-client constraints honored throughout:
//   - Inline styles only (no <style> blocks, no CSS variables, no custom fonts).
//     Instrument Serif isn't available in most clients, so the display fallback
//     stack is Georgia → Times → generic serif.
//   - Single hex colors per declaration (no rgba/oklch).
//   - Tables for any multi-row data layout (Outlook handles them best).
//   - Dashed borders are render-safe across Gmail, Outlook, Apple Mail.

export type EyebrowTone = 'moss' | 'oxblood' | 'bark'

// Hex pairs mirror the in-app Tailwind theme tokens defined in globals.css.
// Updating either side without the other will drift the visual identity.
const TONE_COLORS: Record<EyebrowTone, string> = {
  moss: '#2F4A35',
  oxblood: '#8A2E2A',
  bark: '#7A4A2A',
}

const COLOR = {
  cream: '#F1EADC',
  card: '#FBF6EA',
  ink: '#1C2421',
  ink2: '#43504A',
  ink3: '#7A8580',
  rule: '#D9CFB7',
  moss: '#2F4A35',
  mossAlt: '#3D6346',
  oxblood: '#8A2E2A',
} as const

const FONT_SERIF = "Georgia, 'Times New Roman', Times, serif"
const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export interface EmailShellArgs {
  /** Browser-tab title (also used by accessibility tools). */
  title: string
  /** Tiny-caps accent label above the headline (e.g. "Request approved"). */
  eyebrow: string
  eyebrowTone: EyebrowTone
  /** Display-serif headline. HTML allowed — wrap fragments in <em> for italic. */
  headline: string
  /** Body slot. Pre-built HTML — typically a salutation, body paragraphs,
   *  a details table (use detailsTable), optional action buttons, and a
   *  sign-off paragraph. */
  body: string
}

/** HTML-escape user-supplied strings before they're interpolated into the
 *  template. Existing templates were unescaped, so a teacher named
 *  `<script>...</script>` would have rendered raw in the admin's email body.
 *  Most email clients sanitize on the rendering side, but escaping at the
 *  source is the cheapest defense-in-depth. Use this for every value that
 *  originated outside the application — teacher_name, reason, etc. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function emailShell({ title, eyebrow, eyebrowTone, headline, body }: EmailShellArgs): string {
  const eyebrowColor = TONE_COLORS[eyebrowTone]

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.cream};font-family:${FONT_SANS};color:${COLOR.ink};-webkit-font-smoothing:antialiased;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <!-- Wordmark -->
    <div style="margin-bottom:24px;">
      <div style="font-family:${FONT_SERIF};font-size:20px;color:${COLOR.ink};line-height:1.1;">Faculty Time-Off</div>
      <div style="margin-top:4px;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:600;color:${COLOR.ink3};">Leave requests</div>
    </div>

    <!-- Card -->
    <div style="background-color:${COLOR.card};border:1px solid ${COLOR.rule};border-radius:6px;padding:36px 32px;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:${eyebrowColor};">● ${eyebrow}</div>
      <h1 style="margin:14px 0 22px 0;font-family:${FONT_SERIF};font-size:34px;line-height:1.08;font-weight:400;letter-spacing:-0.01em;color:${COLOR.ink};">${headline}</h1>
      <div style="font-size:16px;line-height:1.55;color:${COLOR.ink2};">${body}</div>
    </div>

    <!-- Footer -->
    <div style="margin-top:24px;padding:0 8px;font-size:11px;letter-spacing:0.06em;color:${COLOR.ink3};">
      Sent by the Faculty Time-Off Request System.
    </div>
  </div>
</body>
</html>`
}

/** Single body paragraph using ink-2 secondary text. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.55;color:${COLOR.ink2};">${html}</p>`
}

/** Italic pull-quote for reasons / teacher notes. */
export function pullQuote(html: string): string {
  return `<p style="margin:18px 0;font-family:${FONT_SERIF};font-style:italic;font-size:17px;line-height:1.5;color:${COLOR.ink2};">&ldquo;${html}&rdquo;</p>`
}

/** Sign-off block — used at the end of teacher-facing emails. */
export function signOff(): string {
  return `<p style="margin:24px 0 0 0;font-size:16px;color:${COLOR.ink2};">
    Warm regards,<br />
    <strong style="color:${COLOR.ink};">School Administration</strong>
  </p>`
}

/** Render an array of label/value pairs as a dashed-rule details table.
 *  Labels are tiny-caps eyebrow, values are display-serif. The last row's
 *  bottom border is omitted so the table reads as a clean block. */
export function detailsTable(rows: Array<[label: string, value: string]>): string {
  const cells = rows
    .map(([label, value], i) => {
      const isLast = i === rows.length - 1
      const borderBottom = isLast ? 'none' : `1px dashed ${COLOR.rule}`
      return `<tr>
        <td style="padding:14px 0;border-bottom:${borderBottom};width:35%;vertical-align:top;">
          <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:${COLOR.ink3};">${label}</div>
        </td>
        <td style="padding:14px 0;border-bottom:${borderBottom};font-family:${FONT_SERIF};font-size:18px;color:${COLOR.ink};">${value}</td>
      </tr>`
    })
    .join('')
  return `<table style="width:100%;border-collapse:collapse;margin:8px 0 18px 0;" cellspacing="0" cellpadding="0">
    <tbody>${cells}</tbody>
  </table>`
}

/** Large primary button (moss). Used for "Approve" in the admin notification. */
export function buttonPrimary(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${COLOR.moss};color:${COLOR.cream};padding:13px 26px;border-radius:4px;font-weight:700;font-size:15px;letter-spacing:0.02em;text-decoration:none;">${label}</a>`
}

/** Large secondary button (oxblood). Used for "Deny" in the admin notification. */
export function buttonDanger(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background-color:${COLOR.oxblood};color:${COLOR.cream};padding:13px 26px;border-radius:4px;font-weight:700;font-size:15px;letter-spacing:0.02em;text-decoration:none;">${label}</a>`
}

/** Row container for buttonPrimary + buttonDanger. */
export function buttonRow(...buttons: string[]): string {
  // Email clients render display:inline-block reliably; a flex container would
  // collapse in Outlook. The 12px non-breaking gap separator keeps the buttons
  // from touching when they wrap.
  const gap = `<span style="display:inline-block;width:12px;height:1px;"></span>`
  return `<div style="margin-top:8px;">${buttons.join(gap)}</div>`
}
