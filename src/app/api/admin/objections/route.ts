import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  category: z.string().min(1).max(40),
  industry: z.nativeEnum(Industry).nullable().optional(),
  trigger:  z.string().min(1).max(400),
  rebuttal: z.string().min(1).max(4000),
  source:   z.string().max(200).optional().nullable(),
  active:   z.boolean().optional(),
});

function requireSuperadmin(role: string) {
  if (role !== "SUPERADMIN") throw new ApiError(403, "Superadmin only");
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    requireSuperadmin(user.role);
    const templates = await prisma.objectionTemplate.findMany({
      orderBy: [{ active: "desc" }, { category: "asc" }, { trigger: "asc" }],
    });
    return NextResponse.json({ templates });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    requireSuperadmin(user.role);
    const data = createSchema.parse(await req.json());
    const created = await prisma.objectionTemplate.create({
      data: {
        category: data.category.toUpperCase(),
        industry: data.industry ?? null,
        trigger: data.trigger,
        rebuttal: data.rebuttal,
        source: data.source ?? null,
        active: data.active ?? true,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionTemplate",
      entityId: created.id,
      action: "CREATE",
      after: { category: created.category, trigger: created.trigger, industry: created.industry },
      ...getAuditContext(req),
    });
    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
