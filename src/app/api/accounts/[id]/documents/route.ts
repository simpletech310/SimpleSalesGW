import { NextResponse } from "next/server";
import { z } from "zod";
import { SignedDocStatus, SignedDocType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { canSeeCustomer, can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  type: z.nativeEnum(SignedDocType),
  title: z.string().min(1).max(200),
  status: z.nativeEnum(SignedDocStatus).optional(),
  signedByName: z.string().max(200).optional(),
  signedByEmail: z.string().email().optional().or(z.literal("")),
  signedAt: z.string().datetime().optional().or(z.literal("")),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
  publicUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const c = await prisma.customer.findUnique({ where: { id }, select: { lead: { select: { ownerUserId: true } } } });
    if (!c) throw new ApiError(404, "Customer not found");
    if (!canSeeCustomer(user.role, user.id, c.lead.ownerUserId)) throw new ApiError(403, "Forbidden");
    const documents = await prisma.signedDocument.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    });
    return NextResponse.json({ documents });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const c = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new ApiError(404, "Customer not found");
    const data = createSchema.parse(await req.json());

    const doc = await prisma.signedDocument.create({
      data: {
        customerId: id,
        type: data.type,
        title: data.title,
        status: data.status ?? SignedDocStatus.DRAFT,
        signedByName: data.signedByName || null,
        signedByEmail: data.signedByEmail || null,
        signedAt: data.signedAt ? new Date(data.signedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        publicUrl: data.publicUrl || null,
        notes: data.notes || null,
        uploadedByUserId: user.id,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "SignedDocument",
      entityId: doc.id,
      action: "CREATE",
      after: { customerId: id, type: data.type, title: data.title, status: doc.status },
      ...getAuditContext(req),
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
