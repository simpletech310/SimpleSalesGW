import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { STRINGS } from "@/lib/strings";
import { scoreBadgeClass, formatScore } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeaderBand, Callout } from "@/components/brand";
import { StageTimeline } from "@/components/process/StageTimeline";
import { LeadTabs } from "./LeadTabs";
import { PricingCard } from "./PricingCard";
import { QualificationCard } from "./QualificationCard";
import { CloseDealButtons } from "./CloseDealButtons";
import { HandoffCard } from "./HandoffCard";
import { ScoreOverrideButton } from "./ScoreOverrideButton";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { DealKindPicker } from "./DealKindPicker";
import { ServiceQuoteCard } from "./ServiceQuoteCard";
import { PreSaleAssessmentPanel } from "./PreSaleAssessmentPanel";
import type { LineItem } from "@/lib/pricing/deal-kinds";
import { DealKind, HandoffStatus, PipelineStage } from "@prisma/client";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { name: true } } },
      },
      notes: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        include: { actor: { select: { name: true } } },
      },
      assessments: {
        orderBy: { createdAt: "desc" },
        include: { answers: true, createdBy: { select: { name: true } } },
      },
      serviceMatches: true,
      researchArtifacts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) notFound();
  if (!leadIsVisible(session.user.role, session.user.id, lead.ownerUserId, lead.pipelineStage)) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-gtn-navy">{STRINGS.auth.notAuthorized}</h2>
      </Card>
    );
  }

  // v2.14 — handoff-state probe for the CLOSED_WON-without-handoff CTA.
  // We pull the latest handoff so the banner can either nudge "initiate
  // one" or surface "waiting on COO" depending on status.
  const latestHandoff = await prisma.handoff.findFirst({
    where: { leadId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      initiator: { select: { name: true } },
    },
  });

  // v2.15.2 — orphan-detection: did the accepted handoff actually produce a
  // Customer? If not, HandoffCard surfaces a "Create account now" button so
  // ops can recover without filing a ticket.
  const existingCustomer = await prisma.customer.findUnique({
    where: { leadId: id },
    select: { id: true },
  });

  const auditLogs = can(session.user.role, "audit:view")
    ? await prisma.auditLog.findMany({
        where: { entityId: id },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
        take: 50,
      })
    : [];

  // v2.14 — banner decision tree:
  //   CLOSED_WON + no handoff at all (or only DRAFT)
  //     → "Initiate handoff" warn CTA
  //   CLOSED_WON + INITIATED handoff
  //     → "Waiting on COO" info CTA
  //   Otherwise: no banner
  const closedWon = lead.pipelineStage === PipelineStage.CLOSED_WON;
  const hasLiveHandoff =
    latestHandoff != null && latestHandoff.status !== HandoffStatus.DRAFT;
  const handoffWaitingAcceptance =
    latestHandoff?.status === HandoffStatus.INITIATED;
  const handoffAccepted = latestHandoff?.status === HandoffStatus.ACCEPTED;

  return (
    <div className="space-y-6">
      <PageHeaderBand pageTitle={`Lead · ${lead.businessName}`} />

      {/* v2.14 — Closed-won-without-handoff: the most common "why isn't there
          an account?" footgun. Surface it loud at the top of the page. */}
      {closedWon && !hasLiveHandoff && (
        <Callout kind="warning" label="Action needed">
          <p className="mb-2">
            This deal is closed-won but no handoff is on the way yet. An Account
            won&apos;t be created under <strong>/accounts</strong> until you initiate
            a Sales-to-Ops handoff and the COO accepts it.
          </p>
          {can(session.user.role, "handoff:initiate") ? (
            <Link
              href={`/leads/${lead.id}/handoff`}
              className="inline-flex items-center gap-1 text-sm font-medium text-gtn-purple hover:text-gtn-purple-2"
            >
              Initiate handoff to Ops <ArrowRight size={14} />
            </Link>
          ) : (
            <p className="text-xs text-gtn-grey-2">
              Ask {lead.owner.name} (the lead owner) to initiate a handoff.
            </p>
          )}
        </Callout>
      )}
      {closedWon && handoffWaitingAcceptance && (
        <Callout kind="note" label="Waiting on Ops">
          <p>
            Handoff sent <strong>{latestHandoff?.initiator.name ?? "by the owner"}</strong>.
            Waiting on the COO to accept — once they do, an Account will appear under{" "}
            <Link href="/accounts" className="text-gtn-purple hover:underline">/accounts</Link>{" "}
            and the vCIO takes over Discovery + onboarding.
          </p>
        </Callout>
      )}
      {closedWon && handoffAccepted && (
        <Callout kind="tip" label="Handoff accepted">
          <p>
            This deal is now a Customer under{" "}
            <Link href="/accounts" className="text-gtn-purple hover:underline inline-flex items-center gap-1">
              /accounts <ArrowRight size={12} />
            </Link>
          </p>
        </Callout>
      )}
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gtn-navy truncate">{lead.businessName}</h1>
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            <span className="gtn-stage-chip">{STRINGS.pipeline.stages[lead.pipelineStage]}</span>
            <span className="text-gtn-grey-2">{lead.industry.replace(/_/g, " ")}</span>
            {lead.seatCount && <span className="text-gtn-grey-2">· {lead.seatCount} seats</span>}
            {lead.addressCity && (
              <span className="text-gtn-grey-2">· {lead.addressCity}, {lead.addressState}</span>
            )}
            {lead.nonStrategicFlag && (
              <span className="text-xs uppercase font-semibold text-gtn-red">Non-strategic</span>
            )}
          </div>
          {/* v2.15 — deal-kind inline editor */}
          <div className="mt-2">
            <DealKindPicker
              leadId={lead.id}
              currentKind={lead.dealKind}
              canEdit={lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(session.user.role, "assessment:run") && (
            <Button asChild variant="secondary">
              <Link href={`/leads/${lead.id}/assessment/start`}>Run assessment</Link>
            </Button>
          )}
          {can(session.user.role, "outreach:send") && (
            <Button asChild variant="secondary">
              <Link href={`/leads/${lead.id}/outreach`}>Send outreach</Link>
            </Button>
          )}
          {(lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")) && (
            <Button asChild variant="secondary">
              <Link href={`/leads/${lead.id}/discovery-call`}>Discovery call</Link>
            </Button>
          )}
          {can(session.user.role, "handoff:initiate") && (
            <Button asChild>
              <Link href={`/leads/${lead.id}/handoff`}>Handoff to Ops</Link>
            </Button>
          )}
          {can(session.user.role, "lead:delete") && (
            <DeleteLeadButton leadId={lead.id} businessName={lead.businessName} />
          )}
        </div>
      </div>

      {/* 14-stage unified process timeline (v2.3) */}
      <StageTimeline leadId={lead.id} />

      {/* Close-deal controls — terminal stages aren't on the Kanban */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gtn-grey-2">
          Close this deal once signed, mark lost with a reason, or move to Nurture for later.
        </p>
        <CloseDealButtons leadId={lead.id} currentStage={lead.pipelineStage} />
      </div>

      {/* Score strip */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreTile label={STRINGS.scoring.services} value={lead.servicesScore} />
        <ScoreTile label={STRINGS.scoring.customer} value={lead.customerScore} />
        <ScoreTile
          label={STRINGS.scoring.dealQuality}
          value={lead.dealQualityScore}
          primary
          override={
            can(session.user.role, "score:override") ? (
              <ScoreOverrideButton
                leadId={lead.id}
                initialServices={lead.servicesScore}
                initialCustomer={lead.customerScore}
                initialDealQuality={lead.dealQualityScore}
              />
            ) : null
          }
        />
      </div>

      {lead.nonStrategicFlag && (
        <div className="gtn-callout gtn-callout--warning">
          <strong>{STRINGS.assessment.nonStrategicBanner}</strong>
          {lead.nonStrategicApprovalUserId && (
            <p className="text-sm mt-1">Approved · {lead.nonStrategicApprovalReason}</p>
          )}
        </div>
      )}

      <QualificationCard
        leadId={lead.id}
        canEdit={lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")}
      />

      {/* v2.17 — Pre-sale technical scoping by the vCIO. Lin requests it
          right from here; once complete the recommended line items can be
          adopted into the ServiceQuoteCard with one click. */}
      <PreSaleAssessmentPanel
        leadId={lead.id}
        dealKind={lead.dealKind}
        canEdit={lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")}
        canRunDiscovery={can(session.user.role, "discovery:edit")}
      />

      {/* v2.15 — branch on deal kind: MSP bundles use the seat-tier PricingCard;
          everything else gets the line-item ServiceQuoteCard. */}
      {lead.dealKind === DealKind.MANAGED_IT_BUNDLE ? (
        <PricingCard
          leadId={lead.id}
          role={session.user.role}
          suggestedBundle={lead.suggestedBundle}
          seatCount={lead.seatCount}
        />
      ) : (
        <ServiceQuoteCard
          leadId={lead.id}
          role={session.user.role}
          dealKind={lead.dealKind}
          initialLineItems={
            lead.dealLineItems && typeof lead.dealLineItems === "object" && "lines" in lead.dealLineItems
              ? ((lead.dealLineItems as { lines?: LineItem[] }).lines ?? null)
              : null
          }
          canEdit={lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")}
        />
      )}

      <HandoffCard
        leadId={lead.id}
        role={session.user.role}
        hasCustomer={Boolean(existingCustomer)}
      />

      <LeadTabs
        lead={lead as never}
        canEdit={lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any")}
        auditLogs={auditLogs}
      />
    </div>
  );
}

function ScoreTile({ label, value, primary, override }: { label: string; value: number; primary?: boolean; override?: React.ReactNode }) {
  return (
    <div className={primary ? "gtn-card p-4 bg-gtn-navy text-white" : "gtn-card p-4"}>
      <div className="flex items-center justify-between gap-2">
        <p className={primary ? "text-xs uppercase tracking-wide text-white/70" : "text-xs uppercase tracking-wide text-gtn-grey-2"}>
          {label}
        </p>
        {override}
      </div>
      {primary ? (
        <p className="text-3xl font-mono font-bold mt-1">{formatScore(value)}</p>
      ) : (
        <p className="mt-1 inline-block">
          <span className={scoreBadgeClass(value)}>{formatScore(value)}</span>
        </p>
      )}
    </div>
  );
}
