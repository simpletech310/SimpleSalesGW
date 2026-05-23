import { NextResponse } from "next/server";
import { z } from "zod";
import { DiscoveryKind, DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ kind: z.nativeEnum(DiscoveryKind) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "discovery:run")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const { kind } = schema.parse(await req.json());

    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!customer) throw new ApiError(404, "Customer not found");

    const assessment = await prisma.discoveryAssessment.create({
      data: {
        customerId: id,
        kind,
        status: DiscoveryStatus.IN_PROGRESS,
        startedAt: new Date(),
        createdByUserId: user.id,
        answers: {},
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessment.id,
      action: "CREATE",
      after: { customerId: id, kind },
      ...getAuditContext(req),
    });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
