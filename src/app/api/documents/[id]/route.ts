import { NextResponse } from "next/server";
import { z } from "zod";
import { SignedDocStatus, SignedDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

const patchSchema = z.object({
  type: z.nativeEnum(SignedDocType).optional(),
  title: z.string().min(1).max(200).optional(),
  status: z.nativeEnum(SignedDocStatus).optional(),
  signedByName: z.string().max(200).nullable().optional(),
  signedByEmail: z.string().email().nullable().optional().or(z.literal("")),
  signedAt: z.string().datetime().nullable().optional().or(z.literal("")),
  expiresAt: z.string().datetime().nullable().optional().or(z.literal("")),
  publicUrl: z.string().url().nullable().optional().or(z.literal("")),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const before = await prisma.signedDocument.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Document not found");

    // Authorize: lead owner OR lead:edit:any (for lead docs) OR onboarding:manage (for customer docs)
    if (before.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: before.leadId }, select: { ownerUserId: true } });
      if (!lead) throw new ApiError(404, "Linked lead missing");
      if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
        throw new ApiError(403, "Forbidden");
      }
    } else if (before.customerId) {
      if (!can(user.role, "onboarding:manage")) throw new ApiError(403, "Forbidden");
    }

    const data = patchSchema.parse(await req.json());
    const updateData: Record<string, unknown> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.signedByName !== undefined) updateData.signedByName = data.signedByName || null;
    if (data.signedByEmail !== undefined) updateData.signedByEmail = data.signedByEmail || null;
    if (data.signedAt !== undefined) updateData.signedAt = data.signedAt ? new Date(data.signedAt) : null;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.publicUrl !== undefined) updateData.publicUrl = data.publicUrl || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    const after = await prisma.signedDocument.update({ where: { id }, data: updateData });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, updateData);
    await writeAudit({
      actorUserId: user.id,
      entityType: "SignedDocument",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ document: after });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const doc = await prisma.signedDocument.findUnique({ where: { id } });
    if (!doc) throw new ApiError(404, "Document not found");

    // Only authors / Sales Manager / Superadmin can delete
    if (doc.uploadedByUserId !== user.id && !can(user.role, "lead:edit:any") && user.role !== "SUPERADMIN") {
      throw new ApiError(403, "Forbidden");
    }
    await prisma.signedDocument.delete({ where: { id } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "SignedDocument",
      entityId: id,
      action: "DELETE",
      before: { leadId: doc.leadId, customerId: doc.customerId, type: doc.type, title: doc.title } as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
