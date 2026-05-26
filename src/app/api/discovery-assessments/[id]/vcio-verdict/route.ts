import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewVerdict } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  verdict: z.nativeEnum(ReviewVerdict),
  notes: z.string().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "proposal:vcio-review") && !can(actor.role, "discovery:edit")) {
      throw new ApiError(403, "Forbidden");
    }
    const { id } = await params;
    const { verdict, notes } = schema.parse(await req.json());
    const assessment = await prisma.discoveryAssessment.update({
      where: { id },
      data: {
        vcioVerdict: verdict,
        vcioVerdictAt: new Date(),
        vcioVerdictById: actor.id,
        vcioVerdictNotes: notes,
      },
    });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "DiscoveryAssessment",
      entityId: id,
      action: verdict === ReviewVerdict.APPROVED ? "APPROVE" : "REJECT",
      after: { verdict } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ assessment });
  } catch (err) {
    return jsonError(err);
  }
}
