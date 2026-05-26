import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, ServiceBundle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  bundle: z.nativeEnum(ServiceBundle).nullable().optional(),
  industry: z.nativeEnum(Industry).nullable().optional(),
  active: z.boolean().optional(),
  scopeMarkdown: z.string().optional(),
  deliverablesMarkdown: z.string().optional(),
  timelineMarkdown: z.string().optional(),
  exclusionsMarkdown: z.string().optional(),
  termsMarkdown: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id } = await params;
    const template = await prisma.sowTemplate.findUnique({ where: { id } });
    if (!template) throw new ApiError(404, "Not found");
    return NextResponse.json({ template });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "sow:template:edit")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());
    const before = await prisma.sowTemplate.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Not found");
    const after = await prisma.sowTemplate.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
    await writeAudit({
      actorUserId: actor.id,
      entityType: "SowTemplate",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ template: after });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "sow:template:edit")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    // Soft delete = mark inactive; preserves history for already-drafted proposals
    const template = await prisma.sowTemplate.update({ where: { id }, data: { active: false } });
    await writeAudit({
      actorUserId: actor.id,
      entityType: "SowTemplate",
      entityId: id,
      action: "DELETE",
      after: { archived: true, name: template.name } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
