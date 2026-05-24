import { NextResponse } from "next/server";
import { z } from "zod";
import { DealKind, Industry, LeadSource, type Prisma, type PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { can, leadVisibilityFilter } from "@/lib/rbac";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";

const createSchema = z.object({
  businessName: z.string().min(1).max(200),
  dbaName: z.string().max(200).optional(),
  industry: z.nativeEnum(Industry),
  subindustry: z.string().max(200).optional(),
  seatCount: z.coerce.number().int().nonnegative().optional(),
  siteCount: z.coerce.number().int().positive().default(1),
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(50).optional(),
  addressZip: z.string().max(20).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  linkedinCompanyUrl: z.string().url().optional().or(z.literal("")),
  primaryContactName: z.string().max(200).optional(),
  primaryContactTitle: z.string().max(200).optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal("")),
  primaryContactPhone: z.string().max(50).optional(),
  source: z.nativeEnum(LeadSource).default(LeadSource.INBOUND),
  // v2.15 — what kind of deal is this. Drives PricingCard form + onboarding template.
  dealKind: z.nativeEnum(DealKind).default(DealKind.MANAGED_IT_BUNDLE),
  notes: z.string().max(5000).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const stage = url.searchParams.get("stage");

    const where: Prisma.LeadWhereInput = {
      ...leadVisibilityFilter(user.role, user.id),
      ...(stage ? { pipelineStage: stage as PipelineStage } : {}),
      ...(q
        ? {
            OR: [
              { businessName: { contains: q, mode: "insensitive" } },
              { primaryContactName: { contains: q, mode: "insensitive" } },
              { primaryContactEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { name: true, email: true } } },
    });
    return NextResponse.json({ leads });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "lead:create")) throw new ApiError(403, "Forbidden");
    const json = await req.json();
    const data = createSchema.parse(json);

    const { notes, ...leadFields } = data;
    const lead = await prisma.lead.create({
      data: {
        ...leadFields,
        websiteUrl: leadFields.websiteUrl || null,
        linkedinCompanyUrl: leadFields.linkedinCompanyUrl || null,
        primaryContactEmail: leadFields.primaryContactEmail || null,
        ownerUserId: user.id,
      },
    });

    if (notes && notes.trim()) {
      await prisma.note.create({
        data: { leadId: lead.id, actorUserId: user.id, body: notes.trim(), pinned: true },
      });
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: lead.id,
      action: "CREATE",
      after: lead as unknown as Record<string, unknown>,
      ...getAuditContext(req),
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
