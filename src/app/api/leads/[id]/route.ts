import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, LeadSource, PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit, diffForAudit } from "@/lib/audit";

const updateSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  dbaName: z.string().max(200).nullable().optional(),
  industry: z.nativeEnum(Industry).optional(),
  subindustry: z.string().max(200).nullable().optional(),
  seatCount: z.coerce.number().int().nonnegative().nullable().optional(),
  siteCount: z.coerce.number().int().positive().optional(),
  addressStreet: z.string().max(200).nullable().optional(),
  addressCity: z.string().max(100).nullable().optional(),
  addressState: z.string().max(50).nullable().optional(),
  addressZip: z.string().max(20).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional().or(z.literal("")),
  linkedinCompanyUrl: z.string().url().nullable().optional().or(z.literal("")),
  primaryContactName: z.string().max(200).nullable().optional(),
  primaryContactTitle: z.string().max(200).nullable().optional(),
  primaryContactEmail: z.string().email().nullable().optional().or(z.literal("")),
  primaryContactPhone: z.string().max(50).nullable().optional(),
  executiveSponsorName: z.string().max(200).nullable().optional(),
  executiveSponsorTitle: z.string().max(200).nullable().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  pipelineStage: z.nativeEnum(PipelineStage).optional(),
  researchSummary: z.string().max(20_000).nullable().optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
  closedLostReason: z.string().max(2_000).nullable().optional(),
});

async function ensureCanEdit(leadId: string, user: { id: string; role: import("@prisma/client").Role }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new ApiError(404, "Lead not found");
  if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
    throw new ApiError(403, "Forbidden");
  }
  return lead;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } },
        notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], include: { actor: { select: { name: true } } } },
        assessments: { orderBy: { createdAt: "desc" }, include: { answers: true } },
        serviceMatches: true,
        researchArtifacts: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage)) {
      throw new ApiError(403, "Forbidden");
    }
    return NextResponse.json({ lead });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const before = await ensureCanEdit(id, user);
    const json = await req.json();
    const data = updateSchema.parse(json);

    const cleaned: Record<string, unknown> = { ...data };
    if (cleaned.websiteUrl === "") cleaned.websiteUrl = null;
    if (cleaned.linkedinCompanyUrl === "") cleaned.linkedinCompanyUrl = null;
    if (cleaned.primaryContactEmail === "") cleaned.primaryContactEmail = null;
    if (typeof cleaned.expectedCloseDate === "string") {
      cleaned.expectedCloseDate = new Date(cleaned.expectedCloseDate);
    }

    const after = await prisma.lead.update({ where: { id }, data: cleaned });
    const diff = diffForAudit(before as unknown as Record<string, unknown>, cleaned);
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      before: diff.before as never,
      after: diff.after as never,
      ...getAuditContext(req),
    });
    return NextResponse.json({ lead: after });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:delete")) throw new ApiError(403, "Forbidden");
    const { id } = await params;

    // Reason is required per PRD §10. Accept it in body or as ?reason= query.
    let reason: string | undefined;
    try {
      const body = (await req.json()) as { reason?: string } | null;
      reason = body?.reason?.trim();
    } catch {
      reason = new URL(req.url).searchParams.get("reason")?.trim() ?? undefined;
    }
    if (!reason) throw new ApiError(400, "Deletion reason is required.");

    const before = await prisma.lead.findUnique({ where: { id } });
    if (!before) throw new ApiError(404, "Not found");
    await prisma.lead.delete({ where: { id } });
    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "DELETE",
      before: {
        ...(before as unknown as Record<string, unknown>),
        deletionReason: reason,
      },
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
