/**
 * Aggregate notification payload for the current user.
 * Shared between the API route and the SSR page so they stay in sync.
 */

import { AssessmentStatus, HandoffStatus, PricingApprovalStatus, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { approvalTier } from "@/lib/pricing";

export type NotificationsPayload = {
  total: number;
  openActions: Array<{
    activityId: string;
    leadId: string;
    leadName: string;
    nextAction: string;
    dueAt: string;
  }>;
  assessmentsAwaiting: Array<{
    id: string;
    leadId: string;
    leadName: string;
    respondentEmail: string | null;
    sentAt: string;
  }>;
  pricingApprovalsPending: Array<{
    id: string;
    leadId: string;
    leadName: string;
    discountPct: number;
    proposedPrice: number;
    stickerPrice: number;
    requesterName: string;
    createdAt: string;
  }>;
  handoffsAwaiting: Array<{
    id: string;
    leadId: string;
    leadName: string;
    initiatorName: string;
    initiatedAt: string;
  }>;
};

export async function loadNotifications(user: { id: string; role: Role }): Promise<NotificationsPayload> {
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [openActions, assessments, pricingPending, handoffsAwaiting] = await Promise.all([
    prisma.activity.findMany({
      where: {
        actorUserId: user.id,
        nextActionCompleted: false,
        nextActionDueAt: { not: null, lte: sevenDaysOut },
      },
      orderBy: { nextActionDueAt: "asc" },
      include: { lead: { select: { id: true, businessName: true } } },
      take: 30,
    }),
    prisma.assessment.findMany({
      where: {
        status: AssessmentStatus.IN_PROGRESS,
        ...(can(user.role, "lead:view:all") ? {} : { lead: { ownerUserId: user.id } }),
      },
      orderBy: { startedAt: "desc" },
      include: { lead: { select: { id: true, businessName: true } } },
      take: 30,
    }),
    can(user.role, "pricing:approve:5to20") || can(user.role, "pricing:approve:20plus")
      ? prisma.pricingApproval.findMany({
          where: { status: PricingApprovalStatus.PENDING },
          orderBy: { createdAt: "desc" },
          include: {
            lead: { select: { id: true, businessName: true } },
            requester: { select: { name: true } },
          },
          take: 30,
        })
      : Promise.resolve([]),
    can(user.role, "handoff:accept")
      ? prisma.handoff.findMany({
          where: { status: HandoffStatus.INITIATED },
          orderBy: { initiatedAt: "desc" },
          include: {
            lead: { select: { id: true, businessName: true } },
            initiator: { select: { name: true } },
          },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  // Filter pricing approvals by tier the user can actually decide
  const pricingFiltered = pricingPending.filter((p) => {
    const tier = approvalTier(Number(p.discountPct));
    if (tier === "MANAGER") return can(user.role, "pricing:approve:5to20");
    if (tier === "COO") return can(user.role, "pricing:approve:20plus");
    return false;
  });

  const payload: NotificationsPayload = {
    total: 0,
    openActions: openActions
      .filter((a) => a.nextAction && a.nextActionDueAt)
      .map((a) => ({
        activityId: a.id,
        leadId: a.lead.id,
        leadName: a.lead.businessName,
        nextAction: a.nextAction!,
        dueAt: a.nextActionDueAt!.toISOString(),
      })),
    assessmentsAwaiting: assessments
      .filter((a) => a.mode === "SELF_SERVICE_LINK" || a.mode === "HYBRID")
      .map((a) => ({
        id: a.id,
        leadId: a.lead.id,
        leadName: a.lead.businessName,
        respondentEmail: a.respondentEmail,
        sentAt: (a.startedAt ?? a.createdAt).toISOString(),
      })),
    pricingApprovalsPending: pricingFiltered.map((p) => ({
      id: p.id,
      leadId: p.lead.id,
      leadName: p.lead.businessName,
      discountPct: Number(p.discountPct),
      proposedPrice: Number(p.proposedPrice),
      stickerPrice: Number(p.stickerPrice),
      requesterName: p.requester.name,
      createdAt: p.createdAt.toISOString(),
    })),
    handoffsAwaiting: handoffsAwaiting.map((h) => ({
      id: h.id,
      leadId: h.lead.id,
      leadName: h.lead.businessName,
      initiatorName: h.initiator.name,
      initiatedAt: (h.initiatedAt ?? h.createdAt).toISOString(),
    })),
  };
  payload.total =
    payload.openActions.length +
    payload.assessmentsAwaiting.length +
    payload.pricingApprovalsPending.length +
    payload.handoffsAwaiting.length;
  return payload;
}
