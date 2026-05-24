import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { AssessmentMode, AssessmentStatus, ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { expiryFromDays, generateToken, tokenFingerprint } from "@/lib/assessment/tokens";
import { renderAssessmentInvite } from "@/lib/email/templates/assessment-invite";
import { env } from "@/lib/env";

const schema = z.object({
  leadId: z.string().uuid(),
  mode: z.nativeEnum(AssessmentMode).default(AssessmentMode.IN_PERSON),
  respondentName: z.string().max(200).optional(),
  respondentEmail: z.string().email().optional(),
  expiryDays: z.coerce.number().int().min(1).max(60).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "assessment:run")) throw new ApiError(403, "Forbidden");
    const data = schema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
    if (!lead) throw new ApiError(404, "Lead not found");
    // v2.8 defense-in-depth: only the owner (or someone with lead:edit:any)
    // can launch an assessment on this lead.
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — you don't own this lead.");
    }

    const isSelfService = data.mode === AssessmentMode.SELF_SERVICE_LINK || data.mode === AssessmentMode.HYBRID;
    if (isSelfService && !data.respondentEmail) {
      throw new ApiError(400, "respondentEmail is required for self-service / hybrid mode");
    }

    const token = isSelfService ? generateToken() : null;
    const expiresAt = isSelfService
      ? expiryFromDays(data.expiryDays ?? Number(process.env.ASSESSMENT_LINK_EXPIRY_DAYS ?? 14))
      : null;

    const assessment = await prisma.assessment.create({
      data: {
        leadId: data.leadId,
        createdByUserId: user.id,
        mode: data.mode,
        status: AssessmentStatus.IN_PROGRESS,
        startedAt: new Date(),
        respondentName: data.respondentName ?? null,
        respondentEmail: data.respondentEmail ?? null,
        magicLinkToken: token,
        magicLinkExpiresAt: expiresAt,
      },
    });

    let emailSent = false;
    let publicLink: string | null = null;
    if (isSelfService && token) {
      const baseUrl = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
      publicLink = `${baseUrl}/assessment/respond/${token}`;

      if (data.respondentEmail) {
        const apiKey = env().RESEND_API_KEY;
        if (apiKey) {
          const rendered = renderAssessmentInvite({
            respondentName: data.respondentName ?? null,
            businessName: lead.businessName,
            link: publicLink,
            expiresAt,
            senderName: user.name,
          });
          const resend = new Resend(apiKey);
          const result = await resend.emails.send({
            from: env().EMAIL_FROM,
            to: data.respondentEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            replyTo: env().EMAIL_REPLY_TO,
          });
          if (!result.error) emailSent = true;
        }
      }
    }

    await prisma.activity.create({
      data: {
        leadId: data.leadId,
        actorUserId: user.id,
        type: isSelfService ? ActivityType.ASSESSMENT_SENT : ActivityType.ASSESSMENT_COMPLETED,
        subject: isSelfService
          ? `Assessment link sent${data.respondentEmail ? ` to ${data.respondentEmail}` : ""}${emailSent ? "" : " (email not delivered — link copy/paste)"}`
          : "Assessment started in person",
        body: publicLink ? `Token fingerprint: ${tokenFingerprint(token!)}` : null,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Assessment",
      entityId: assessment.id,
      action: "CREATE",
      after: {
        leadId: data.leadId,
        mode: data.mode,
        respondentEmail: data.respondentEmail ?? null,
        tokenFingerprint: token ? tokenFingerprint(token) : null,
        emailSent,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ assessment, publicLink, emailSent }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
