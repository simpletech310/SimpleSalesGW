import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  servicesBelow: z.number().int().min(0).max(100),
  dealQualityBelow: z.number().int().min(0).max(100),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "system:config")) throw new ApiError(403, "Forbidden");
    const data = schema.parse(await req.json());
    const row = await prisma.systemConfig.upsert({
      where: { key: "scoring.thresholds" },
      update: { value: data },
      create: { key: "scoring.thresholds", value: data },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "SystemConfig",
      entityId: row.id,
      action: "UPDATE",
      after: data,
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
