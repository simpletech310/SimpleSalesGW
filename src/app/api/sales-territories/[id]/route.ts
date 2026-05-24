import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const citySchema = z.object({ city: z.string().min(1).max(100), state: z.string().length(2) });
const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()])).min(3)),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  teamId: z.string().uuid().optional(),
  states: z.array(z.string().length(2)).max(60).optional(),
  zipCodes: z.array(z.string().min(3).max(10)).max(5000).optional(),
  cities: z.array(citySchema).max(500).optional(),
  polygon: polygonSchema.nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.teamId !== undefined) data.teamId = body.teamId;
    if (body.states !== undefined) data.states = body.states.map((s) => s.toUpperCase());
    if (body.zipCodes !== undefined) data.zipCodes = body.zipCodes.map((z) => z.trim());
    if (body.cities !== undefined) data.cities = body.cities;
    if (body.polygon !== undefined) data.polygon = body.polygon;
    if (body.active !== undefined) data.active = body.active;

    const territory = await prisma.salesTerritory.update({ where: { id }, data });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTerritory",
      entityId: id,
      action: "UPDATE",
      after: data as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ territory });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "team:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    await prisma.salesTerritory.update({ where: { id }, data: { active: false } });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesTerritory",
      entityId: id,
      action: "DELETE",
      after: { active: false },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
