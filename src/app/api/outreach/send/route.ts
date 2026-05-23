import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { env } from "@/lib/env";
import { renderBrandedEmail } from "@/lib/email/render";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  leadId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  templateId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "outreach:send")) throw new ApiError(403, "Forbidden");
    const data = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new ApiError(404, "Lead not found");

    const rendered = renderBrandedEmail({ subject: data.subject, bodyText: data.body });
    const apiKey = env().RESEND_API_KEY;

    let resendId: string | null = null;
    let sentReally = false;
    if (apiKey) {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: env().EMAIL_FROM,
        to: data.to,
        subject: data.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: env().EMAIL_REPLY_TO,
      });
      if (result.error) {
        throw new ApiError(502, `Resend error: ${result.error.message}`);
      }
      resendId = result.data?.id ?? null;
      sentReally = true;
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: lead.id,
        actorUserId: user.id,
        type: ActivityType.EMAIL,
        subject: `Outreach: ${data.subject}`,
        body: data.body,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Outreach",
      entityId: activity.id,
      action: "CREATE",
      after: {
        to: data.to,
        subject: data.subject,
        templateId: data.templateId ?? null,
        resendId,
        actuallySent: sentReally,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      ok: true,
      sent: sentReally,
      resendId,
      message: sentReally ? "Sent." : "Logged as activity (RESEND_API_KEY not configured — no email sent).",
    });
  } catch (err) {
    return jsonError(err);
  }
}
