import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { scopeQcSow } from "@/lib/ai/sow-scope-qc";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:vcio-review") && !can(actor.role, "proposal:draft")) {
      throw new ApiError(403, "Forbidden");
    }
    const { id: leadId, proposalId } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { scopeMarkdown: true, deliverablesMarkdown: true },
    });
    if (!proposal) throw new ApiError(404, "Not found");

    const discoveries = await prisma.discoveryAssessment.findMany({
      where: { leadId, status: "COMPLETED" },
      select: { kind: true, scorecard: true },
    });

    const result = await scopeQcSow(
      {
        proposal: { scopeMarkdown: proposal.scopeMarkdown, deliverablesMarkdown: proposal.deliverablesMarkdown },
        discovery: discoveries.map((d) => ({
          kind: d.kind,
          summary: d.scorecard ? JSON.stringify(d.scorecard).slice(0, 800) : "(no scorecard)",
        })),
      },
      { leadId, userId: actor.id },
    );

    if (result.ok) {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { aiScopeQcJson: result.value as unknown as object, aiScopeQcAt: new Date() },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
