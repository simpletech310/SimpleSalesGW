import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { checkHandoff } from "@/lib/ai/handoff-qc";
import { AnthropicNotConfiguredError, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";

/**
 * v2.20 — POST /api/handoffs/[id]/qc
 *
 * Runs Claude over the structured 60-field handoff payload and returns
 * `{ severity, issues[], suggestions[], summary }`. Caches the result
 * on `Handoff.qcResult` so the COO sees it on the HandoffCard without
 * re-spending tokens.
 *
 * RBAC: the lead owner (sales) OR anyone who can accept handoffs (COO).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;

    const handoff = await prisma.handoff.findUnique({
      where: { id },
      include: { lead: { select: { id: true, ownerUserId: true, businessName: true, industry: true, seatCount: true, complianceDrivers: true } } },
    });
    if (!handoff) throw new ApiError(404, "Handoff not found");

    const isOwner = handoff.lead.ownerUserId === user.id;
    if (!isOwner && !can(user.role, "handoff:accept") && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    if (!isAnthropicConfigured()) throw new AnthropicNotConfiguredError();

    const result = await checkHandoff(
      {
        lead: {
          businessName: handoff.lead.businessName,
          industry: handoff.lead.industry,
          seatCount: handoff.lead.seatCount,
          complianceDrivers: handoff.lead.complianceDrivers,
        },
        handoff: {
          dealValue: handoff.dealValue ? Number(handoff.dealValue) : null,
          bundleId: handoff.bundleId ? String(handoff.bundleId) : null,
          complianceOverlay: handoff.complianceOverlay,
          contractsSigned: handoff.contractsSigned,
          decisionMakers: handoff.decisionMakers,
          hardCommitments: handoff.hardCommitments,
          softCommitments: handoff.softCommitments,
          objectionsAndSkeptics: handoff.objectionsAndSkeptics,
          stakeholderContext: handoff.stakeholderContext,
          budgetSnapshot: handoff.budgetSnapshot,
          successCriteria: handoff.successCriteria,
          notes: handoff.notes,
        },
      },
      { leadId: handoff.lead.id, userId: user.id },
    );

    const generatedAt = new Date().toISOString();
    await prisma.handoff.update({
      where: { id },
      data: {
        qcResult: {
          severity: result.severity,
          issues: result.issues,
          suggestions: result.suggestions,
          summary: result.summary,
          generatedAt,
          generatedByUserId: user.id,
        } as never,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Handoff",
      entityId: id,
      action: "UPDATE",
      after: {
        qcRun: true,
        severity: result.severity,
        issueCount: result.issues.length,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      severity: result.severity,
      issues: result.issues,
      suggestions: result.suggestions,
      summary: result.summary,
      generatedAt,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { error: err.message, scope: err.scope, reason: err.reason },
        { status: 429 },
      );
    }
    return jsonError(err);
  }
}
