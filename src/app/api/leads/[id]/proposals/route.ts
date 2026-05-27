import { NextResponse } from "next/server";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { draftSow } from "@/lib/ai/sow-draft";

const createSchema = z.object({
  templateId: z.string().uuid().optional(),
  aiAssist: z.boolean().default(false),
  /** Manual seed text when no template + no AI is used. */
  seed: z.object({
    scopeMarkdown: z.string(),
    deliverablesMarkdown: z.string(),
    timelineMarkdown: z.string(),
    exclusionsMarkdown: z.string(),
    termsMarkdown: z.string(),
  }).optional(),
});

async function getOwnedLead(leadId: string, userId: string, role: Role) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerUserId: true, pipelineStage: true, teamId: true },
  });
  if (!lead) throw new ApiError(404, "Lead not found");
  if (!leadIsVisible(role, userId, lead.ownerUserId, lead.pipelineStage, lead.teamId ?? null, [])) {
    throw new ApiError(403, "Forbidden");
  }
  return lead;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    const { id: leadId } = await params;
    await getOwnedLead(leadId, actor.id, actor.role);
    const proposals = await prisma.proposal.findMany({
      where: { leadId },
      orderBy: { version: "desc" },
      include: {
        template: { select: { id: true, name: true, bundle: true } },
        vcioReviewedBy: { select: { name: true } },
        managerReviewedBy: { select: { name: true } },
        sentBy: { select: { name: true } },
      },
    });
    return NextResponse.json({ proposals });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "quote:create") || !can(actor.role, "proposal:draft")) {
      throw new ApiError(
        403,
        "Sales reps can't author quotes. Use the 'Request quote' button so a manager or vCIO can draft it.",
      );
    }
    const { id: leadId } = await params;
    await getOwnedLead(leadId, actor.id, actor.role);
    const body = createSchema.parse(await req.json());

    // Build the seed sections.
    let seed = body.seed ?? {
      scopeMarkdown: "",
      deliverablesMarkdown: "",
      timelineMarkdown: "",
      exclusionsMarkdown: "",
      termsMarkdown: "",
    };
    let template: { id: string; name: string; scopeMarkdown: string; deliverablesMarkdown: string; timelineMarkdown: string; exclusionsMarkdown: string; termsMarkdown: string } | null = null;
    if (body.templateId) {
      template = await prisma.sowTemplate.findUnique({
        where: { id: body.templateId },
        select: { id: true, name: true, scopeMarkdown: true, deliverablesMarkdown: true, timelineMarkdown: true, exclusionsMarkdown: true, termsMarkdown: true },
      });
      if (!template) throw new ApiError(400, "Template not found");
      seed = {
        scopeMarkdown: template.scopeMarkdown,
        deliverablesMarkdown: template.deliverablesMarkdown,
        timelineMarkdown: template.timelineMarkdown,
        exclusionsMarkdown: template.exclusionsMarkdown,
        termsMarkdown: template.termsMarkdown,
      };
    }

    // Pricing snapshot from the lead's most recent approved/pending pricing approval.
    const pricing = await prisma.pricingApproval.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    const pricingSnapshot = pricing ? {
      proposedPriceMrr: Number(pricing.proposedPrice ?? 0),
      proposedPriceOneTime: Number(pricing.proposedOneTime ?? 0),
      discountPct: Number(pricing.discountPct ?? 0),
      bundle: pricing.bundleId,
      status: pricing.status,
    } : {};

    // Determine next version
    const lastVersion = await prisma.proposal.findFirst({
      where: { leadId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // AI assist (best-effort — failure does not block creation)
    let aiDraftedAt: Date | null = null;
    let aiDraftModel: string | null = null;
    if (body.aiAssist && template) {
      const fullLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { businessName: true, industry: true, seatCount: true, siteCount: true, complianceDrivers: true, triggerEvent: true },
      });
      const discoveries = await prisma.discoveryAssessment.findMany({
        where: { leadId, status: "COMPLETED" },
        select: { kind: true, scorecard: true },
      });
      if (fullLead) {
        const result = await draftSow(
          {
            lead: {
              businessName: fullLead.businessName,
              industry: fullLead.industry,
              seatCount: fullLead.seatCount,
              siteCount: fullLead.siteCount,
              complianceDrivers: fullLead.complianceDrivers,
              statedPain: null,
              triggerEvent: fullLead.triggerEvent,
            },
            template,
            discovery: discoveries.map((d) => ({
              kind: d.kind,
              summary: d.scorecard ? JSON.stringify(d.scorecard).slice(0, 800) : "(no scorecard)",
            })),
            pricingSnapshot,
          },
          { leadId, userId: actor.id },
        );
        if (result.ok) {
          seed = {
            scopeMarkdown: result.value.scopeMarkdown,
            deliverablesMarkdown: result.value.deliverablesMarkdown,
            timelineMarkdown: result.value.timelineMarkdown,
            exclusionsMarkdown: result.value.exclusionsMarkdown,
            termsMarkdown: result.value.termsMarkdown,
          };
          aiDraftedAt = new Date();
          aiDraftModel = "claude";
        }
      }
    }

    const proposal = await prisma.proposal.create({
      data: {
        leadId,
        templateId: template?.id,
        version: nextVersion,
        status: "DRAFT",
        ...seed,
        pricingSnapshot,
        aiDraftedAt,
        aiDraftModel,
      },
    });

    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposal.id,
      action: "CREATE",
      after: { leadId, version: nextVersion, aiAssist: body.aiAssist } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ proposal, aiAssisted: Boolean(aiDraftedAt) });
  } catch (err) {
    return jsonError(err);
  }
}
