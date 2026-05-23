import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  category:     z.string().min(1).max(40),
  text:         z.string().min(1).max(4000),
  templateId:   z.string().uuid().optional().nullable(),
  rebuttalUsed: z.string().max(4000).optional().nullable(),
  outcome:      z.string().max(40).optional().nullable(),
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
  return { user, lead };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { lead } = await authorize(id, false);

    const logs = await prisma.objectionLog.findMany({
      where: { leadId: id },
      orderBy: { raisedAt: "desc" },
      include: {
        template: true,
        raisedBy: { select: { id: true, name: true } },
      },
    });

    // Reference catalog filtered by category=? or industry — pull active templates
    // matching the lead's industry plus catch-alls (industry: null).
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const leadIndustry = await prisma.lead.findUnique({ where: { id }, select: { industry: true } });
    const where: { active: boolean; category?: string; OR?: Array<{ industry: Industry | null }> } = { active: true };
    if (category) where.category = category;
    if (leadIndustry?.industry) {
      where.OR = [{ industry: leadIndustry.industry }, { industry: null }];
    }
    const reference = await prisma.objectionTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { trigger: "asc" }],
    });

    return NextResponse.json({ logs, reference });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await authorize(id, true);
    const data = createSchema.parse(await req.json());

    let rebuttalUsed = data.rebuttalUsed ?? null;
    if (data.templateId && !rebuttalUsed) {
      const tpl = await prisma.objectionTemplate.findUnique({ where: { id: data.templateId } });
      if (tpl) rebuttalUsed = tpl.rebuttal;
    }

    const log = await prisma.objectionLog.create({
      data: {
        leadId: id,
        templateId: data.templateId ?? null,
        category: data.category.toUpperCase(),
        text: data.text,
        rebuttalUsed,
        outcome: data.outcome ?? null,
        raisedByUserId: user.id,
      },
      include: {
        template: true,
        raisedBy: { select: { id: true, name: true } },
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "ObjectionLog",
      entityId: log.id,
      action: "CREATE",
      after: { leadId: id, category: log.category, text: log.text.slice(0, 200) },
      ...getAuditContext(req),
    });

    return NextResponse.json({ log }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
