import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { regenerateSection, type SowSection } from "@/lib/ai/sow-draft";

const SECTION_FIELD: Record<SowSection, "scopeMarkdown" | "deliverablesMarkdown" | "timelineMarkdown" | "exclusionsMarkdown" | "termsMarkdown"> = {
  scope: "scopeMarkdown",
  deliverables: "deliverablesMarkdown",
  timeline: "timelineMarkdown",
  exclusions: "exclusionsMarkdown",
  terms: "termsMarkdown",
};

const schema = z.object({
  section: z.enum(["scope", "deliverables", "timeline", "exclusions", "terms"]),
  instruction: z.string().min(3).max(2000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "proposal:draft")) {
      throw new ApiError(403, "Only quote authors can regenerate sections.");
    }
    const { id: leadId, proposalId } = await params;
    const { section, instruction } = schema.parse(await req.json());

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        leadId: true, status: true,
        scopeMarkdown: true, deliverablesMarkdown: true, timelineMarkdown: true, exclusionsMarkdown: true, termsMarkdown: true,
        pricingSnapshot: true,
      },
    });
    if (!proposal || proposal.leadId !== leadId) throw new ApiError(404, "Proposal not found");
    if (proposal.status !== "DRAFT" && proposal.status !== "VCIO_REVIEW" && proposal.status !== "MANAGER_REVIEW") {
      throw new ApiError(400, "Section can only be regenerated while the proposal is in draft or review.");
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { businessName: true, industry: true, seatCount: true, siteCount: true, complianceDrivers: true, triggerEvent: true },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    const discoveries = await prisma.discoveryAssessment.findMany({
      where: { leadId, status: "COMPLETED" },
      select: { kind: true, scorecard: true },
    });

    const result = await regenerateSection(
      {
        section,
        instruction,
        lead: {
          businessName: lead.businessName,
          industry: lead.industry,
          seatCount: lead.seatCount,
          siteCount: lead.siteCount,
          complianceDrivers: lead.complianceDrivers,
          statedPain: null,
          triggerEvent: lead.triggerEvent,
        },
        template: {
          name: "section-refine",
          scopeMarkdown: proposal.scopeMarkdown,
          deliverablesMarkdown: proposal.deliverablesMarkdown,
          timelineMarkdown: proposal.timelineMarkdown,
          exclusionsMarkdown: proposal.exclusionsMarkdown,
          termsMarkdown: proposal.termsMarkdown,
        },
        discovery: discoveries.map((d) => ({
          kind: String(d.kind),
          summary: typeof d.scorecard === "object" && d.scorecard
            ? JSON.stringify(d.scorecard).slice(0, 1000)
            : "",
        })),
        pricingSnapshot: (proposal.pricingSnapshot ?? {}) as Record<string, unknown>,
        currentDraft: {
          scopeMarkdown: proposal.scopeMarkdown,
          deliverablesMarkdown: proposal.deliverablesMarkdown,
          timelineMarkdown: proposal.timelineMarkdown,
          exclusionsMarkdown: proposal.exclusionsMarkdown,
          termsMarkdown: proposal.termsMarkdown,
        },
      },
      { leadId, userId: user.id },
    );

    if (!result.ok) {
      throw new ApiError(502, `AI regenerate failed: ${result.detail}`);
    }

    const field = SECTION_FIELD[section];
    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: { [field]: result.value.markdown, aiDraftedAt: new Date() },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: "UPDATE",
      after: { event: "AI_REGENERATE_SECTION", section, instruction: instruction.slice(0, 200), notes: result.value.notes },
      ...getAuditContext(req),
    });

    return NextResponse.json({ proposal: updated, notes: result.value.notes });
  } catch (err) {
    return jsonError(err);
  }
}
