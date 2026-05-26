import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, ServiceBundle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  bundle: z.nativeEnum(ServiceBundle).nullable().optional(),
  industry: z.nativeEnum(Industry).nullable().optional(),
  scopeMarkdown: z.string().default(""),
  deliverablesMarkdown: z.string().default(""),
  timelineMarkdown: z.string().default(""),
  exclusionsMarkdown: z.string().default(""),
  termsMarkdown: z.string().default(""),
});

export async function GET(req: Request) {
  try {
    await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const bundle = searchParams.get("bundle") as ServiceBundle | null;
    const industry = searchParams.get("industry") as Industry | null;
    const activeOnly = searchParams.get("active") !== "false";

    const templates = await prisma.sowTemplate.findMany({
      where: {
        ...(activeOnly ? { active: true } : {}),
        ...(bundle ? { bundle } : {}),
        ...(industry ? { industry } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: { createdBy: { select: { name: true } } },
    });
    return NextResponse.json({ templates });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "sow:template:edit")) throw new ApiError(403, "Forbidden");
    const data = createSchema.parse(await req.json());
    const template = await prisma.sowTemplate.create({
      data: { ...data, createdByUserId: actor.id },
    });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "SowTemplate",
      entityId: template.id,
      action: "CREATE",
      after: { name: template.name, bundle: template.bundle } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ template });
  } catch (err) {
    return jsonError(err);
  }
}
