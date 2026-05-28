/**
 * Branded HTML email shell — inline CSS only (Gmail/Outlook/Apple Mail safe).
 *
 * v3.3.25 — header band now embeds the real Gateway TelNet PNG lockup
 * (gateway-header.png), wrapped in a white pill so the black wordmark
 * stays readable against the navy band. Email clients render the PNG
 * reliably from a public URL.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://gatewaytelnet.com";

export function renderBrandedEmail(opts: { subject: string; bodyText: string }): { html: string; text: string } {
  const logoUrl = `${APP_URL.replace(/\/$/, "")}/icons/gateway-header.png`;
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
          <td style="background:#0F0E2E;padding:20px 28px">
            <span style="display:inline-block;background:#ffffff;border-radius:6px;padding:6px 10px">
              <img src="${logoUrl}" alt="Gateway TelNet" width="160" height="55" style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:160px">
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px 28px">
            <p style="margin:0;color:#0F0E2E;font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(opts.bodyText)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px 28px;color:#6B6B6B;font-size:12px;line-height:1.5">
            We listen more, talk less.<br>
            Gateway TelNet · License #1100895 · (818) 775-1234
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
