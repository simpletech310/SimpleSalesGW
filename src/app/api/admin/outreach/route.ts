import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, OutreachCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { extractPlaceholders } from "@/lib/outreach/templates";

const createSchema = z.object({
  name:     z.string().min(1).max(120),
  category: z.nativeEnum(OutreachCategory),
  industry: z.nativeEnum(Industry).nullable().optional(),
  trigger:  z.string().max(120).nullable().optional(),
  subject:  z.string().min(1).max(300),
  body:     z.string().min(1).max(20000),
  active:   z.boolean().optional(),
});

function requireSuperadmin(role: string) {
  if (role !== "SUPERADMIN") throw new ApiError(403, "Superadmin only");
}

export async function GET(_req: Request) {
  try {
    const user = await requireSessionUser();
    requireSuperadmin(user.role);
    const templates = await prisma.outreachTemplate.findMany({
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
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

    const placeholders = extractPlaceholders(`${data.subject}\n${data.body}`);

    const created = await prisma.outreachTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        industry: data.industry ?? null,
        trigger: data.trigger ?? null,
        subject: data.subject,
        body: data.body,
        placeholders,
        active: data.active ?? true,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "OutreachTemplate",
      entityId: created.id,
      action: "CREATE",
      after: { name: created.name, category: created.category, industry: created.industry, trigger: created.trigger },
      ...getAuditContext(req),
    });

    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
