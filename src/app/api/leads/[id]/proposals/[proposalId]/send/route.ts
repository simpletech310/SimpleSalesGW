import { NextResponse } from "next/server";
import { SignedDocStatus, SignedDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * Mark proposal as SENT. For v3.3.0 the PDF is rendered by the browser
 * via /leads/[id]/proposal/[proposalId]/print and the rep emails it
 * out-of-portal. We still create a SignedDocument record so the SOW is
 * tracked + appears on the Signed Docs tab.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; proposalId: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:draft")) throw new ApiError(403, "Forbidden");
    const { id: leadId, proposalId } = await params;

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { lead: { select: { businessName: true } } },
    });
    if (!proposal) throw new ApiError(404, "Not found");
    if (proposal.status !== "APPROVED" && proposal.status !== "VCIO_REVIEW" && proposal.status !== "MANAGER_REVIEW" && proposal.status !== "DRAFT") {
      throw new ApiError(400, `Cannot send a proposal in status ${proposal.status}`);
    }

    const [updated, signedDoc] = await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposalId },
        data: { status: "SENT", sentAt: new Date(), sentByUserId: actor.id },
      }),
      prisma.signedDocument.create({
        data: {
          leadId,
          type: SignedDocType.SOW,
          title: `SOW v${proposal.version} — ${proposal.lead.businessName}`,
          status: SignedDocStatus.SENT,
          uploadedByUserId: actor.id,
          notes: `Auto-created from Proposal ${proposalId}`,
        },
      }),
    ]);

    await writeAudit({
      actorUserId: actor.id,
      entityType: "Proposal",
      entityId: proposalId,
      action: "UPDATE",
      after: { status: "SENT", signedDocId: signedDoc.id } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ proposal: updated, signedDoc });
  } catch (err) {
    return jsonError(err);
  }
}
