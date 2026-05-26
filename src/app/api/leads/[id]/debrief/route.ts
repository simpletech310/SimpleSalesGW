import { NextResponse } from "next/server";
import { z } from "zod";
import { PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const PRIMARY_REASONS = ["PRICE", "SCOPE", "TIMING", "TRUST", "RELATIONSHIP", "INCUMBENT", "OTHER"] as const;

const submitSchema = z.object({
  outcome: z.enum([PipelineStage.CLOSED_WON, PipelineStage.CLOSED_LOST]),
  primaryReason: z.enum(PRIMARY_REASONS),
  whatWorked: z.string().max(2000).optional(),
  objectionResolved: z.string().max(2000).optional(),
  templateThatWon: z.string().max(200).optional(),
  whatBroke: z.string().max(2000).optional(),
  playbookUpdate: z.string().min(1).max(2000),
  aiSuggestedJson: z.unknown().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id: leadId } = await params;
    const debrief = await prisma.dealDebrief.findUnique({ where: { leadId } });
    return NextResponse.json({ debrief });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "debrief:submit")) throw new ApiError(403, "Forbidden");
    const { id: leadId } = await params;
    const data = submitSchema.parse(await req.json());

    const debrief = await prisma.dealDebrief.upsert({
      where: { leadId },
      create: {
        leadId,
        outcome: data.outcome,
        primaryReason: data.primaryReason,
        whatWorked: data.whatWorked ?? null,
        objectionResolved: data.objectionResolved ?? null,
        templateThatWon: data.templateThatWon ?? null,
        whatBroke: data.whatBroke ?? null,
        playbookUpdate: data.playbookUpdate,
        submittedById: actor.id,
        aiSuggestedAt: data.aiSuggestedJson ? new Date() : null,
        ...(data.aiSuggestedJson ? { aiSuggestedJson: data.aiSuggestedJson as object } : {}),
      },
      update: {
        outcome: data.outcome,
        primaryReason: data.primaryReason,
        whatWorked: data.whatWorked ?? null,
        objectionResolved: data.objectionResolved ?? null,
        templateThatWon: data.templateThatWon ?? null,
        whatBroke: data.whatBroke ?? null,
        playbookUpdate: data.playbookUpdate,
        submittedById: actor.id,
      },
    });

    await writeAudit({
      actorUserId: actor.id,
      entityType: "DealDebrief",
      entityId: debrief.id,
      action: "CREATE",
      after: { outcome: data.outcome, primaryReason: data.primaryReason } as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ debrief });
  } catch (err) {
    return jsonError(err);
  }
}
