import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  category: z.string().min(1).max(40).optional(),
  industry: z.nativeEnum(Industry).nullable().optional(),
  trigger:  z.string().min(1).max(400).optional(),
  rebuttal: z.string().min(1).max(4000).optional(),
  source:   z.string().max(200).nullable().optional(),
  active:   z.boolean().optional(),
});

function requireSuperadmin(role: string) {
  if (role !== "SUPERADMIN") throw new ApiError(403, "Superadmin only");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    requireSuperadmin(user.role);
    const { id } = await params;
    const existing = await prisma.objectionTemplate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Template not found");
    const data = patchSchema.parse(await req.json());
    const updated = await prisma.objectionTemplate.update({
      where: { id },
      data: {
        ...(data.category !== undefined && { category: data.category.toUpperCase() }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.rebuttal !== undefined && { rebuttal: data.rebuttal }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionTemplate",
      entityId: id,
      action: "UPDATE",
      before: { trigger: existing.trigger, active: existing.active },
      after: { trigger: updated.trigger, active: updated.active },
      ...getAuditContext(req),
    });
    return NextResponse.json({ template: updated });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    requireSuperadmin(user.role);
    const { id } = await params;
    const existing = await prisma.objectionTemplate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Template not found");
    await prisma.objectionTemplate.delete({ where: { id } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionTemplate",
      entityId: id,
      action: "DELETE",
      before: { trigger: existing.trigger },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
