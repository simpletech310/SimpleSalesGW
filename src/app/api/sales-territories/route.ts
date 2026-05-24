import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const citySchema = z.object({
  city: z.string().min(1).max(100),
  state: z.string().length(2),
});

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(3)),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  teamId: z.string().uuid(),
  states: z.array(z.string().length(2)).max(60).default([]),
  zipCodes: z.array(z.string().min(3).max(10)).max(5000).default([]),
  cities: z.array(citySchema).max(500).default([]),
  polygon: polygonSchema.nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    const territories = can(user.role, "team:manage")
      ? await prisma.salesTerritory.findMany({
          orderBy: { name: "asc" },
          include: { team: { select: { id: true, name: true, active: true } } },
        })
      : await prisma.salesTerritory.findMany({
          where: { active: true, team: { members: { some: { userId: user.id } } } },
          orderBy: { name: "asc" },
          include: { team: { select: { id: true, name: true, active: true } } },
        });
    return NextResponse.json({ territories });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const body = createSchema.parse(await req.json());

    const territory = await prisma.salesTerritory.create({
      data: {
        name: body.name,
        teamId: body.teamId,
        states: body.states.map((s) => s.toUpperCase()),
        zipCodes: body.zipCodes.map((z) => z.trim()),
        cities: body.cities as never,
        polygon: (body.polygon ?? null) as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTerritory",
      entityId: territory.id,
      action: "CREATE",
      after: {
        name: territory.name,
        teamId: territory.teamId,
        states: territory.states.length,
        zipCount: territory.zipCodes.length,
        cityCount: Array.isArray(body.cities) ? body.cities.length : 0,
        hasPolygon: Boolean(body.polygon),
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ territory });
  } catch (err) {
    return jsonError(err);
  }
}
