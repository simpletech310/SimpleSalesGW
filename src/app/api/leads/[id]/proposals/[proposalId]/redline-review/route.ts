import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const requestSchema = z.object({ reason: z.string().min(10).max(2000) });
const resolveSchema = z.object({ resolution: z.string().min(2).max(2000) });

/**
 * Salesperson requests a COO contract review (redline) on a SENT proposal.
 * COO resolves with a written outcome.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    const { proposalId } = await params;
    const { searchParams } = new URL(req.url);
    const op = searchParams.get("op") ?? "request"; // request | resolve

    if (op === "resolve") {
      if (!can(actor.role, "handoff:accept")) throw new ApiError(403, "Forbidden");
      const { resolution } = resolveSchema.parse(await req.json());
      const proposal = await prisma.proposal.update({
        where: { id: proposalId },
        data: { redlineResolvedAt: new Date(), redlineResolution: resolution },
      });
      await writeAudit({
        actorUserId: actor.id,
        entityType: "Proposal",
        entityId: proposalId,
        action: "UPDATE",
        after: { redlineResolved: true } as never,
        ...getAuditContext(req),
      });
      return NextResponse.json({ proposal });
    }

    if (!can(actor.role, "proposal:draft")) throw new ApiError(403, "Forbidden");
    const { reason } = requestSchema.parse(await req.json());
    const proposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: { redlineRequestedAt: new Date(), redlineRequestReason: reason, redlineResolvedAt: null, redlineResolution: null },
    });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: "UPDATE",
      after: { redlineRequested: true, reason } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ proposal });
  } catch (err) {
    return jsonError(err);
  }
}
