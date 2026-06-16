import { NextResponse } from "next/server";
import { z } from "zod";
import { DiscoveryKind, DiscoveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadIsVisible } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

/**
 * v2.17 — Lead-scoped pre-sale DiscoveryAssessment management.
 *
 * POST: salesperson (or any user with `lead:edit:any`) requests vCIO
 *       scoping. Creates a DiscoveryAssessment with leadId set + status
 *       NOT_STARTED; vCIO sees it on /notifications and runs it.
 * GET:  lists all pre-sale assessments attached to this lead.
 *
 * Mirrors `src/app/api/accounts/[id]/discovery/route.ts` but lead-scoped.
 */

const createSchema = z.object({ kind: z.nativeEnum(DiscoveryKind) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { ownerUserId: true, pipelineStage: true },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    // v2.17.1 — VCIO's `leadIsVisible` short-circuits to PRE_SALES+, but
    // pre-sale scoping happens on early-stage leads. Bypass for anyone
    // with `discovery:edit` since they may have been asked to scope this lead.
    const canSee =
      leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage) ||
      can(user.role, "discovery:edit");
    if (!canSee) {
      throw new ApiError(403, "Forbidden");
    }
    const assessments = await prisma.discoveryAssessment.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    });
    return NextResponse.json({ assessments });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { ownerUserId: true, pipelineStage: true },
    });
    if (!lead) throw new ApiError(404, "Lead not found");
    // Salesperson can request scoping on their own lead; managers / above
    // can request on any. (Lin doesn't have `discovery:run` — that's for
    // VCIO who actually answers the questions — but she's allowed to
    // create the request row.)
    // v3.8 — the vCIO (discovery:run) also creates assessments directly when
    // performing the accepted site survey, so allow that role here too.
    if (
      lead.ownerUserId !== user.id &&
      !can(user.role, "lead:edit:any") &&
      !can(user.role, "discovery:run")
    ) {
      throw new ApiError(403, "Forbidden");
    }

    const { kind } = createSchema.parse(await req.json());

    const assessment = await prisma.discoveryAssessment.create({
      data: {
        leadId: id,
        kind,
        status: DiscoveryStatus.NOT_STARTED,
        createdByUserId: user.id,
        answers: {},
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryAssessment",
      entityId: assessment.id,
      action: "CREATE",
      after: { leadId: id, kind, scope: "pre-sale" },
      ...getAuditContext(req),
    });

    return NextResponse.json({ assessment }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
