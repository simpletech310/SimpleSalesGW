import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.22 — Sales teams.
 *
 *   GET  /api/sales-teams   — list (manager: all, rep: their teams only)
 *   POST /api/sales-teams   — create (requires team:manage)
 */

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  serviceLines: z.array(z.nativeEnum(ServiceLine)).max(20).default([]),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    const teams = can(user.role, "team:manage")
      ? await prisma.salesTeam.findMany({
          orderBy: { name: "asc" },
          include: {
            _count: { select: { members: true, territories: true, leads: true } },
          },
        })
      : await prisma.salesTeam.findMany({
          where: { active: true, members: { some: { userId: user.id } } },
          orderBy: { name: "asc" },
          include: {
            _count: { select: { members: true, territories: true, leads: true } },
          },
        });
    return NextResponse.json({ teams });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const body = createSchema.parse(await req.json());

    const team = await prisma.salesTeam.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        serviceLines: body.serviceLines,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTeam",
      entityId: team.id,
      action: "CREATE",
      after: { name: team.name, serviceLines: team.serviceLines },
      ...getAuditContext(req),
    });

    return NextResponse.json({ team });
  } catch (err) {
    return jsonError(err);
  }
}
