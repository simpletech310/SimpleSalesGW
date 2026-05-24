import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { personalizeOutreach, type OutreachTone } from "@/lib/ai/outreach-personalizer";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

const BodySchema = z.object({
  templateId: z.string().uuid(),
  tone: z.enum(["warm", "formal", "follow_up"]).default("warm"),
});

/**
 * v2.20 — POST /api/leads/[id]/outreach/personalize
 *
 * Body: { templateId, tone }
 * Returns: { subject, body, notes }
 *
 * RBAC: lead owner OR lead:edit:any.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id: leadId } = await params;
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) throw new ApiError(400, "Invalid request body");
    const { templateId, tone } = parsed.data;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        businessName: true,
        industry: true,
        seatCount: true,
        addressCity: true,
        addressState: true,
        complianceDrivers: true,
        currentMspName: true,
        currentMspSatisfaction: true,
        primaryContactName: true,
        primaryContactTitle: true,
        researchSummary: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage)) {
      throw new ApiError(403, "Forbidden");
    }
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden — only the lead owner or a manager can personalize outreach.");
    }

    const template = await prisma.outreachTemplate.findUnique({
      where: { id: templateId },
      select: { name: true, category: true, subject: true, body: true },
    });
    if (!template) throw new ApiError(404, "Template not found");

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const result = await personalizeOutreach(
      {
        lead: {
          businessName: lead.businessName,
          industry: lead.industry,
          seatCount: lead.seatCount,
          addressCity: lead.addressCity,
          addressState: lead.addressState,
          complianceDrivers: lead.complianceDrivers,
          currentMspName: lead.currentMspName,
          currentMspSatisfaction: lead.currentMspSatisfaction,
          primaryContactName: lead.primaryContactName,
          primaryContactTitle: lead.primaryContactTitle,
          researchSummary: lead.researchSummary,
        },
        template: {
          name: template.name,
          category: String(template.category),
          subject: template.subject,
          body: template.body,
        },
        senderName: user.name,
        tone: tone as OutreachTone,
      },
      { leadId, userId: user.id },
    );

    await prisma.researchArtifact.create({
      data: {
        leadId,
        type: ResearchArtifactType.OUTREACH_DRAFT,
        sourceUrl: null,
        payload: {
          templateId,
          tone,
          subject: result.subject,
          body: result.body,
          notes: result.notes,
          generatedAt: new Date().toISOString(),
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: leadId,
      action: "UPDATE",
      after: { outreachPersonalized: true, templateId, tone },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      subject: result.subject,
      body: result.body,
      notes: result.notes,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { error: err.message, scope: err.scope, reason: err.reason },
        { status: 429 },
      );
    }
    return jsonError(err);
  }
}
