import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { clampDimension, scoreQualification } from "@/lib/qualification";

const schema = z.object({
  industryFit:      z.coerce.number().int().min(0).max(15).optional(),
  sizeFit:          z.coerce.number().int().min(0).max(15).optional(),
  geography:        z.coerce.number().int().min(0).max(10).optional(),
  growthPosture:    z.coerce.number().int().min(0).max(10).optional(),
  authority:        z.coerce.number().int().min(0).max(15).optional(),
  budget:           z.coerce.number().int().min(0).max(15).optional(),
  timeline:         z.coerce.number().int().min(0).max(10).optional(),
  complianceDriver: z.coerce.number().int().min(0).max(10).optional(),
  reasonCodes:      z.array(z.string().max(60)).max(20).optional(),
  notes:            z.string().max(4000).optional(),
});

async function authorize(leadId: string, write: boolean) {
  const user = await requireSessionUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { ownerUserId: true } });
  if (!lead) throw new ApiError(404, "Lead not found");
  const isOwner = lead.ownerUserId === user.id;
  if (write) {
    if (!isOwner && !can(user.role, "lead:edit:any")) throw new ApiError(403, "Forbidden");
  } else {
    if (!isOwner && !can(user.role, "lead:view:all")) throw new ApiError(403, "Forbidden");
  }
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await authorize(id, false);
    const card = await prisma.qualificationScorecard.findUnique({
      where: { leadId: id },
      include: { scoredBy: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ qualification: card });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await authorize(id, true);
    const data = schema.parse(await req.json());

    const clamped = {
      industryFit:      clampDimension("industryFit",      data.industryFit      ?? 0),
      sizeFit:          clampDimension("sizeFit",          data.sizeFit          ?? 0),
      geography:        clampDimension("geography",        data.geography        ?? 0),
      growthPosture:    clampDimension("growthPosture",    data.growthPosture    ?? 0),
      authority:        clampDimension("authority",        data.authority        ?? 0),
      budget:           clampDimension("budget",           data.budget           ?? 0),
      timeline:         clampDimension("timeline",         data.timeline         ?? 0),
      complianceDriver: clampDimension("complianceDriver", data.complianceDriver ?? 0),
    };
    const { total, verdict } = scoreQualification(clamped);
    const reasonCodes = (data.reasonCodes ?? []).slice(0, 20);

    const existing = await prisma.qualificationScorecard.findUnique({ where: { leadId: id } });

    const card = await prisma.qualificationScorecard.upsert({
      where: { leadId: id },
      create: {
        leadId: id,
        ...clamped,
        total,
        verdict,
        reasonCodes,
        notes: data.notes ?? null,
        scoredByUserId: user.id,
        scoredAt: new Date(),
      },
      update: {
        ...clamped,
        total,
        verdict,
        reasonCodes,
        notes: data.notes ?? null,
        scoredByUserId: user.id,
        scoredAt: new Date(),
      },
      include: { scoredBy: { select: { id: true, name: true, email: true } } },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "QualificationScorecard",
      entityId: card.id,
      action: existing ? "UPDATE" : "CREATE",
      before: existing
        ? { total: existing.total, verdict: existing.verdict }
        : null,
      after: { leadId: id, total, verdict, ...clamped },
      ...getAuditContext(req),
    });

    // v3.3.23 — re-derive + persist Services/Customer/DealQuality so the
    // leads list, pipeline board, and dashboards reflect the same score
    // the lead-detail tiles compute (no more "DQ 48 here, 0 over there").
    try {
      const { recomputeAndStoreLeadScores } = await import("@/lib/scoring/persist-derived");
      await recomputeAndStoreLeadScores(id);
    } catch (e) {
      console.warn("[qualification] derived-score recompute failed:", (e as Error).message);
    }

    return NextResponse.json({ qualification: card }, { status: existing ? 200 : 201 });
  } catch (err) {
    return jsonError(err);
  }
}
