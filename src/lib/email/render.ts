/**
 * Branded HTML email shell — inline CSS only (Gmail/Outlook/Apple Mail safe).
 */
export function renderBrandedEmail(opts: { subject: string; bodyText: string }): { html: string; text: string } {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;background:#EFEEFB;font-family:Inter,Helvetica,Arial,sans-serif;color:#1F1F2D">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#EFEEFB;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:8px;box-shadow:0 1px 4px rgba(15,14,46,0.06);overflow:hidden">
        <tr>
          <td style="background:#0F0E2E;padding:24px 28px;color:#fff;font-size:22px;font-weight:700">
            <span style="font-style:italic">Gateway</span>
            <span style="display:inline-block;margin-left:8px;letter-spacing:6px;font-size:11px;font-weight:600;vertical-align:middle">TELNET</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px">
            <p style="margin:0;color:#0F0E2E;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(opts.bodyText)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px 28px;color:#6B6B6B;font-size:12px">
            Gateway TelNet · Sales made simple. Operations made sure.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { html, text: opts.bodyText };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
