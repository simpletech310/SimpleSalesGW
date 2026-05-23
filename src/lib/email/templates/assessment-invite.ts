/**
 * Branded HTML email for the self-service assessment invite.
 * Returns { subject, html, text } ready for Resend.
 */

import { renderBrandedEmail } from "@/lib/email/render";

export function renderAssessmentInvite(opts: {
  respondentName?: string | null;
  businessName: string;
  link: string;
  expiresAt: Date | null;
  senderName: string;
}): { subject: string; html: string; text: string } {
  const greeting = opts.respondentName ? `Hi ${opts.respondentName.split(" ")[0]},` : "Hi,";
  const expiryLine = opts.expiresAt
    ? `\nThis link expires on ${opts.expiresAt.toDateString()}.`
    : "";

  const bodyText =
`${greeting}

${opts.senderName} from Gateway TelNet here. To get the most useful conversation about your tech, we'd love for you to fill out our 25-question Basic IT Assessment about ${opts.businessName}. It takes about 10 minutes and runs on your phone or laptop.

Start here: ${opts.link}
${expiryLine}
Once you submit, we'll have the right context for our next call — no busywork, no rerouting.

Thanks,
${opts.senderName}
Gateway TelNet`;

  const rendered = renderBrandedEmail({
    subject: `${opts.businessName} — Gateway IT Assessment`,
    bodyText,
  });

  return {
    subject: `${opts.businessName} — Gateway IT Assessment`,
    html: rendered.html,
    text: rendered.text,
  };
}
