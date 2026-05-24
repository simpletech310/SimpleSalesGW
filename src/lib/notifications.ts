/**
 * Aggregate notification payload for the current user.
 * Shared between the API route and the SSR page so they stay in sync.
 */

import {
  AssessmentStatus,
  DiscoveryStatus,
  HandoffStatus,
  OnboardingTaskStatus,
  PricingApprovalStatus,
  type Role,
} from "@prisma/client";
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
    /** v2.9 — actor when viewing as a manager (own actions for ICs). */
    actorName?: string;
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
    belowFloor: boolean;
    /** "MANAGER" or "COO" — drives which RBAC permission the row needs. */
    tier: "MANAGER" | "COO";
    createdAt: string;
  }>;
  handoffsAwaiting: Array<{
    id: string;
    leadId: string;
    leadName: string;
    initiatorName: string;
    initiatedAt: string;
  }>;
  overdueOnboarding: Array<{
    taskId: string;
    customerId: string;
    customerName: string;
    title: string;
    phase: string;
    dueAt: string;
  }>;
  upcomingQbrs: Array<{
    id: string;
    customerId: string;
    customerName: string;
    scheduledAt: string;
  }>;
  inProgressDiscovery: Array<{
    id: string;
    customerId: string;
    customerName: string;
    kind: string;
    startedAt: string;
  }>;
};

export async function loadNotifications(user: { id: string; role: Role }): Promise<NotificationsPayload> {
  const now = new Date();
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isVcio = can(user.role, "onboarding:manage") || user.role === "VCIO";
  // v2.9 — Sales Manager + COO + Superadmin see team-wide overdue next-actions,
  // not just their own. Salespeople still see only their own queue.
  const seesAllLeads = can(user.role, "lead:view:all");

  const [
    openActions,
    assessments,
    pricingPending,
    handoffsAwaiting,
    overdueTasks,
    upcomingQbrs,
    inProgressDiscovery,
  ] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...(seesAllLeads ? {} : { actorUserId: user.id }),
        nextActionCompleted: false,
        nextActionDueAt: { not: null, lte: sevenDaysOut },
      },
      orderBy: { nextActionDueAt: "asc" },
      include: {
        lead: { select: { id: true, businessName: true } },
        actor: { select: { id: true, name: true } },
      },
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
    // Overdue onboarding tasks owned by the current user (or all for vCIO/COO).
    can(user.role, "onboarding:manage")
      ? prisma.onboardingTask.findMany({
          where: {
            status: { notIn: [OnboardingTaskStatus.DONE, OnboardingTaskStatus.SKIPPED] },
            dueAt: { not: null, lte: now },
            ...(isVcio ? {} : { ownerUserId: user.id }),
          },
          orderBy: { dueAt: "asc" },
          include: { customer: { include: { lead: { select: { businessName: true } } } } },
          take: 30,
        })
      : Promise.resolve([]),
    // Upcoming QBRs in next 30 days (vCIO/COO).
    isVcio
      ? prisma.qbr.findMany({
          where: { completedAt: null, scheduledAt: { lte: thirtyDaysOut } },
          orderBy: { scheduledAt: "asc" },
          include: { customer: { include: { lead: { select: { businessName: true } } } } },
          take: 30,
        })
      : Promise.resolve([]),
    // In-progress discovery assessments (vCIO's queue).
    isVcio
      ? prisma.discoveryAssessment.findMany({
          where: { status: DiscoveryStatus.IN_PROGRESS },
          orderBy: { startedAt: "desc" },
          include: { customer: { include: { lead: { select: { businessName: true } } } } },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  // Filter pricing approvals by the tier the user can actually decide.
  // Below-floor pricing always escalates to COO regardless of percent.
  const pricingFiltered = pricingPending.filter((p) => {
    const tier = p.belowFloor ? "COO" : approvalTier(Number(p.discountPct));
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
        actorName: seesAllLeads && a.actor?.id !== user.id ? a.actor?.name : undefined,
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
      belowFloor: p.belowFloor,
      tier: (p.belowFloor ? "COO" : approvalTier(Number(p.discountPct))) as "MANAGER" | "COO",
      createdAt: p.createdAt.toISOString(),
    })),
    handoffsAwaiting: handoffsAwaiting.map((h) => ({
      id: h.id,
      leadId: h.lead.id,
      leadName: h.lead.businessName,
      initiatorName: h.initiator.name,
      initiatedAt: (h.initiatedAt ?? h.createdAt).toISOString(),
    })),
    overdueOnboarding: overdueTasks.map((t) => ({
      taskId: t.id,
      customerId: t.customerId,
      customerName: t.customer.lead.businessName,
      title: t.title,
      phase: t.phase,
      dueAt: t.dueAt!.toISOString(),
    })),
    upcomingQbrs: upcomingQbrs.map((q) => ({
      id: q.id,
      customerId: q.customerId,
      customerName: q.customer.lead.businessName,
      scheduledAt: q.scheduledAt.toISOString(),
    })),
    inProgressDiscovery: inProgressDiscovery.map((d) => ({
      id: d.id,
      customerId: d.customerId,
      customerName: d.customer.lead.businessName,
      kind: d.kind,
      startedAt: (d.startedAt ?? d.createdAt).toISOString(),
    })),
  };
  payload.total =
    payload.openActions.length +
    payload.assessmentsAwaiting.length +
    payload.pricingApprovalsPending.length +
    payload.handoffsAwaiting.length +
    payload.overdueOnboarding.length +
    payload.upcomingQbrs.length +
    payload.inProgressDiscovery.length;
  return payload;
}
