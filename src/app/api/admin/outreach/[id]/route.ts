import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, OutreachCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { extractPlaceholders } from "@/lib/outreach/templates";

const patchSchema = z.object({
  name:     z.string().min(1).max(120).optional(),
  category: z.nativeEnum(OutreachCategory).optional(),
  industry: z.nativeEnum(Industry).nullable().optional(),
  trigger:  z.string().max(120).nullable().optional(),
  subject:  z.string().min(1).max(300).optional(),
  body:     z.string().min(1).max(20000).optional(),
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
    const data = patchSchema.parse(await req.json());

    const existing = await prisma.outreachTemplate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Template not found");

    const nextSubject = data.subject ?? existing.subject;
    const nextBody = data.body ?? existing.body;
    const placeholders =
      data.subject !== undefined || data.body !== undefined
        ? extractPlaceholders(`${nextSubject}\n${nextBody}`)
        : existing.placeholders;

    const updated = await prisma.outreachTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.trigger !== undefined && { trigger: data.trigger }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.active !== undefined && { active: data.active }),
        placeholders,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "OutreachTemplate",
      entityId: id,
      action: "UPDATE",
      before: { name: existing.name, active: existing.active },
      after: { name: updated.name, active: updated.active },
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
    const existing = await prisma.outreachTemplate.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Template not found");
    await prisma.outreachTemplate.delete({ where: { id } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "OutreachTemplate",
      entityId: id,
      action: "DELETE",
      before: { name: existing.name },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
