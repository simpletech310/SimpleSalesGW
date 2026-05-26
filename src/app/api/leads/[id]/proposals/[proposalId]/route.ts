import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  scopeMarkdown: z.string().optional(),
  deliverablesMarkdown: z.string().optional(),
  timelineMarkdown: z.string().optional(),
  exclusionsMarkdown: z.string().optional(),
  termsMarkdown: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    await requireSessionUser();
    const { proposalId } = await params;
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        template: { select: { name: true } },
        lead: { select: { id: true, businessName: true, ownerUserId: true } },
        vcioReviewedBy: { select: { name: true } },
        managerReviewedBy: { select: { name: true } },
        sentBy: { select: { name: true } },
      },
    });
    if (!proposal) throw new ApiError(404, "Not found");
    return NextResponse.json({ proposal });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:draft")) throw new ApiError(403, "Forbidden");
    const { proposalId } = await params;
    const data = patchSchema.parse(await req.json());
    const before = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!before) throw new ApiError(404, "Not found");
    if (before.status !== "DRAFT" && before.status !== "VCIO_REVIEW" && before.status !== "MANAGER_REVIEW") {
      throw new ApiError(400, "Proposal cannot be edited in current status");
    }
    const proposal = await prisma.proposal.update({ where: { id: proposalId }, data });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: "UPDATE",
      after: { editedSections: Object.keys(data) } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ proposal });
  } catch (err) {
    return jsonError(err);
  }
}
