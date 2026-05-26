import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  relationshipNarrative: z.string().max(8000).optional(),
  decisionMakerRecap: z.string().max(4000).optional(),
  day30CommitmentRecap: z.string().max(4000).optional(),
  salesAttended: z.boolean().optional(),
  vcioAttended: z.boolean().optional(),
  notes: z.string().max(4000).optional(),
  aiDraftJson: z.unknown().optional(),
});

async function ensureKickoff(customerId: string) {
  // Idempotent — auto-creates the row if missing (e.g. customers from before v3.3)
  const existing = await prisma.kickoff.findUnique({ where: { customerId } });
  if (existing) return existing;
  return prisma.kickoff.create({ data: { customerId } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id: customerId } = await params;
    const kickoff = await ensureKickoff(customerId);
    return NextResponse.json({ kickoff });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "kickoff:edit")) throw new ApiError(403, "Forbidden");
    const { id: customerId } = await params;
    const data = patchSchema.parse(await req.json());

    await ensureKickoff(customerId);
    const kickoff = await prisma.kickoff.update({
      where: { customerId },
      data: {
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : data.scheduledAt === null ? null : undefined,
        completedAt: data.completedAt ? new Date(data.completedAt) : data.completedAt === null ? null : undefined,
        relationshipNarrative: data.relationshipNarrative,
        decisionMakerRecap: data.decisionMakerRecap,
        day30CommitmentRecap: data.day30CommitmentRecap,
        salesAttended: data.salesAttended,
        vcioAttended: data.vcioAttended,
        notes: data.notes,
        ...(data.aiDraftJson
          ? { aiDraftedAt: new Date(), aiDraftJson: data.aiDraftJson as object }
          : {}),
      },
    });

    await writeAudit({
      actorUserId: actor.id,
      entityType: "Kickoff",
      entityId: kickoff.id,
      action: "UPDATE",
      after: { editedFields: Object.keys(data) } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ kickoff });
  } catch (err) {
    return jsonError(err);
  }
}
