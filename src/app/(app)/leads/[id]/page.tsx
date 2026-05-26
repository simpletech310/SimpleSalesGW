import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { STRINGS } from "@/lib/strings";
import { formatScore } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge, ScoreBadge } from "@/components/ui/Badge";
import { Callout } from "@/components/brand";
import { DetailPage } from "@/components/templates";
import { StageTimeline } from "@/components/process/StageTimeline";
import { LeadTabs } from "./LeadTabs";
import { PricingCard } from "./PricingCard";
import { QualificationCard } from "./QualificationCard";
import { CloseDealButtons } from "./CloseDealButtons";
import { HandoffCard } from "./HandoffCard";
import { ScoreOverrideButton } from "./ScoreOverrideButton";
import { DeleteLeadButton } from "./DeleteLeadButton";
import { AssignToMeButton } from "./AssignToMeButton";
import { DealKindPicker } from "./DealKindPicker";
import { ServiceQuoteCard } from "./ServiceQuoteCard";
import { PreSaleAssessmentPanel } from "./PreSaleAssessmentPanel";
import { AiUsageMeter } from "./AiUsageMeter";
import { EngagementPanel } from "./EngagementPanel";
import { VideoCallButton } from "./VideoCallButton";
import { SalesCoachPanel } from "./SalesCoachPanel";
import type { LineItem } from "@/lib/pricing/deal-kinds";
import { DealKind, HandoffStatus, PipelineStage } from "@prisma/client";
// v3.3.21 — derive a sensible score for the top tiles when the legacy
// MSP-Fit Assessment hasn't been run yet (uses qualification + the
// new per-service fit math from v3.3.15).
import { computeAllServiceFits } from "@/lib/scoring/service-fit";

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
      preSaleAssessments: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      serviceMatches: true,
      researchArtifacts: { orderBy: { createdAt: "desc" } },
      // v3.3.16 — Overview tab summary cards
      attachments: {
        orderBy: { createdAt: "desc" },
        take: 24,
        include: { uploadedBy: { select: { name: true } } },
      },
      qualification: true,
    },
  });
  if (!lead) notFound();

  const teamIds = await userTeamIds(session.user.id);
  const onTeam = lead.teamId ? teamIds.includes(lead.teamId) : false;
  let leadVisible = leadIsVisible(
    session.user.role,
    session.user.id,
    lead.ownerUserId,
    lead.pipelineStage,
    lead.teamId,
    teamIds,
  );
  if (!leadVisible && can(session.user.role, "discovery:edit")) {
    const hasPreSale = await prisma.discoveryAssessment.count({ where: { leadId: id } });
    if (hasPreSale > 0) leadVisible = true;
  }
  if (!leadVisible) {
    return (
      <div className="rounded-xl bg-surface border border-line-subtle p-6 max-w-md">
        <h2 className="text-lg font-semibold text-ink-strong">{STRINGS.auth.notAuthorized}</h2>
      </div>
    );
  }

  // v3.3.23 — Backfill derived scores for legacy leads that pre-date
  // the persist-on-save hook. If the lead has 0 stored scores but a
  // qualification has been scored (or intake fields are populated),
  // recompute + persist once so the leads list / dashboard / pipeline
  // pick up the same value the lead-detail tiles show. Fire-and-
  // forget so the page render isn't blocked.
  if (
    lead.servicesScore === 0 && lead.customerScore === 0 && lead.dealQualityScore === 0 &&
    (lead.qualification?.scoredAt || (lead.interestedServices && lead.interestedServices.length > 0))
  ) {
    void (async () => {
      try {
        const { recomputeAndStoreLeadScores } = await import("@/lib/scoring/persist-derived");
        await recomputeAndStoreLeadScores(id);
      } catch (e) {
        console.warn("[lead/page] backfill derived scores failed:", (e as Error).message);
      }
    })();
  }

  const latestHandoff = await prisma.handoff.findFirst({
    where: { leadId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, initiator: { select: { name: true } } },
  });

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

  const closedWon = lead.pipelineStage === PipelineStage.CLOSED_WON;
  const hasLiveHandoff = latestHandoff != null && latestHandoff.status !== HandoffStatus.DRAFT;
  const handoffWaitingAcceptance = latestHandoff?.status === HandoffStatus.INITIATED;
  const handoffAccepted = latestHandoff?.status === HandoffStatus.ACCEPTED;

  const canEditLead = lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any");
  const canEditLeadOrTeam = canEditLead || onTeam;

  return (
    <DetailPage
      crumbs={[{ href: "/leads", label: "Leads" }, { label: lead.businessName }]}
      eyebrow="Lead"
      title={
        <span className="inline-flex items-center gap-2">
          {lead.businessName}
          {canEditLeadOrTeam && (
            <Link
              href={`/leads/${lead.id}/edit`}
              aria-label="Edit lead"
              title="Edit lead"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-line-subtle bg-surface text-ink-muted hover:text-gtn-purple hover:border-brand hover:bg-brand-soft transition-colors duration-120 ease-smooth"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </span>
      }
      subtitle={
        <>
          {lead.industry.replace(/_/g, " ").toLowerCase()}
          {lead.seatCount ? <> · {lead.seatCount} seats</> : null}
          {lead.addressCity ? <> · {lead.addressCity}, {lead.addressState}</> : null}
          {lead.owner?.name && (
            <>
              {" · "}Owner:{" "}
              <span className={lead.ownerUserId === session.user.id ? "text-gtn-purple font-medium" : "text-ink"}>
                {lead.owner.name}
                {lead.ownerUserId === session.user.id ? " (you)" : ""}
              </span>
            </>
          )}
        </>
      }
      badges={
        <>
          <Badge tone="brand" shape="pill" size="sm">
            {STRINGS.pipeline.stages[lead.pipelineStage]}
          </Badge>
          {lead.nonStrategicFlag && (
            <Badge tone="danger" shape="pill" size="xs">non-strategic</Badge>
          )}
          <DealKindPicker
            leadId={lead.id}
            currentKind={lead.dealKind}
            canEdit={canEditLead}
          />
        </>
      }
      actions={
        <>
          {/* Edit FIRST so it never gets crowded out behind other buttons. */}
          {canEditLeadOrTeam && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads/${lead.id}/edit`} className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Edit lead
              </Link>
            </Button>
          )}
          {can(session.user.role, "assessment:run") && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads/${lead.id}/assessment/start`}>Run assessment</Link>
            </Button>
          )}
          {can(session.user.role, "outreach:send") && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads/${lead.id}/outreach`}>Send outreach</Link>
            </Button>
          )}
          {canEditLead && (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/leads/${lead.id}/discovery-call`}>Discovery call</Link>
            </Button>
          )}
          <VideoCallButton leadId={lead.id} />
          <AiUsageMeter leadId={lead.id} />
          {can(session.user.role, "lead:assign") && lead.ownerUserId !== session.user.id && (
            <AssignToMeButton leadId={lead.id} currentOwnerName={lead.owner.name} />
          )}
          {can(session.user.role, "handoff:initiate") && (
            <Button asChild size="sm">
              <Link href={`/leads/${lead.id}/handoff`}>Handoff to Ops</Link>
            </Button>
          )}
          {can(session.user.role, "lead:delete") && (
            <DeleteLeadButton leadId={lead.id} businessName={lead.businessName} />
          )}
        </>
      }
    >
      {/* Engagement + AI coach */}
      <div className="grid lg:grid-cols-3 gap-4 md:gap-5">
        <div className="lg:col-span-2">
          <EngagementPanel leadId={lead.id} />
        </div>
        <SalesCoachPanel leadId={lead.id} />
      </div>

      {/* Closed-won handoff banner */}
      {closedWon && !hasLiveHandoff && (
        <Callout kind="warning" label="Action needed">
          <p className="mb-2">
            This deal is closed-won but no handoff is on the way yet. An Account won&apos;t be created under{" "}
            <strong>/accounts</strong> until you initiate a Sales-to-Ops handoff and the COO accepts it.
          </p>
          {can(session.user.role, "handoff:initiate") ? (
            <Link
              href={`/leads/${lead.id}/handoff`}
              className="inline-flex items-center gap-1 text-sm font-medium text-gtn-purple hover:text-gtn-purple-2"
            >
              Initiate handoff to Ops <ArrowRight size={14} />
            </Link>
          ) : (
            <p className="text-xs text-ink-muted">
              Ask {lead.owner.name} (the lead owner) to initiate a handoff.
            </p>
          )}
        </Callout>
      )}
      {closedWon && handoffWaitingAcceptance && (
        <Callout kind="note" label="Waiting on Ops">
          <p>
            Handoff sent <strong>{latestHandoff?.initiator.name ?? "by the owner"}</strong>. Waiting on the COO
            to accept — once they do, an Account will appear under{" "}
            <Link href="/accounts" className="text-gtn-purple hover:underline font-medium">/accounts</Link>{" "}
            and the vCIO takes over Discovery + onboarding.
          </p>
        </Callout>
      )}
      {closedWon && handoffAccepted && (
        <Callout kind="tip" label="Handoff accepted">
          <p>
            This deal is now a Customer under{" "}
            <Link href="/accounts" className="text-gtn-purple hover:underline inline-flex items-center gap-1 font-medium">
              /accounts <ArrowRight size={12} />
            </Link>
          </p>
        </Callout>
      )}

      {/* 14-stage process timeline */}
      <StageTimeline leadId={lead.id} />

      {/* Close-deal controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-surface border border-line-subtle p-3.5">
        <p className="text-sm text-ink-muted">
          Close this deal once signed, mark lost with a reason, or move to Nurture for later.
        </p>
        <CloseDealButtons leadId={lead.id} currentStage={lead.pipelineStage} />
      </div>

      {/* v3.3.23 — derived scores are now persisted on save, so most
          leads will show the stored values directly. We keep the
          render-time recompute as a safety net for leads that existed
          before v3.3.23 (no intake save has triggered a backfill yet)
          and as the source of the "(estimated)" tag when no
          qualification/assessment has run. */}
      {(() => {
        const hasAssessmentScore =
          lead.servicesScore > 0 || lead.customerScore > 0 || lead.dealQualityScore > 0;
        // Derive fallback when assessment hasn't been run yet.
        const fitInput = {
          industryFit: lead.qualification?.industryFit ?? 0,
          sizeFit: lead.qualification?.sizeFit ?? 0,
          geography: lead.qualification?.geography ?? 0,
          growthPosture: lead.qualification?.growthPosture ?? 0,
          authority: lead.qualification?.authority ?? 0,
          budget: lead.qualification?.budget ?? 0,
          timeline: lead.qualification?.timeline ?? 0,
          complianceDriver: lead.qualification?.complianceDriver ?? 0,
          industry: lead.industry,
          seatCount: lead.seatCount,
          siteCount: lead.siteCount,
          complianceDrivers: lead.complianceDrivers,
          currentMspName: lead.currentMspName,
          currentMspSatisfaction: lead.currentMspSatisfaction,
          interestedServices: lead.interestedServices ?? [],
          currentPhoneSystem: lead.currentPhoneSystem,
          currentPhonePainPoint: lead.currentPhonePainPoint,
          currentAccessControl: lead.currentAccessControl,
          currentAccessDoorCount: lead.currentAccessDoorCount,
          currentVideoSurveillance: lead.currentVideoSurveillance,
          currentVideoCameraCount: lead.currentVideoCameraCount,
          cablingStatus: lead.cablingStatus,
          expansionPlans: lead.expansionPlans,
          aiAdvisoryInterest: lead.aiAdvisoryInterest,
        };
        const fits = computeAllServiceFits(fitInput);
        const avgTopFits =
          fits.length === 0 ? 0 : Math.round(fits.slice(0, 4).reduce((s, f) => s + f.score, 0) / Math.min(4, fits.length));
        // Customer score derived from generic dims (size + authority + budget + timeline + growth + compliance + industry).
        const qSum = (lead.qualification?.total ?? 0);
        // Show whichever is higher: stored vs derived (lets a recently-run assessment win).
        const servicesScore = hasAssessmentScore ? lead.servicesScore : avgTopFits;
        const customerScore = hasAssessmentScore ? lead.customerScore : qSum;
        const dealQualityScore = hasAssessmentScore
          ? lead.dealQualityScore
          : Math.round((avgTopFits * 0.5) + (qSum * 0.5));
        const derived = !hasAssessmentScore;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <ScoreTile label={STRINGS.scoring.services} value={servicesScore} derived={derived} />
            <ScoreTile label={STRINGS.scoring.customer} value={customerScore} derived={derived} />
            <ScoreTile
              label={STRINGS.scoring.dealQuality}
              value={dealQualityScore}
              primary
              derived={derived}
              override={
                can(session.user.role, "score:override") ? (
                  <ScoreOverrideButton
                    leadId={lead.id}
                    initialServices={servicesScore}
                    initialCustomer={customerScore}
                    initialDealQuality={dealQualityScore}
                  />
                ) : null
              }
            />
          </div>
        );
      })()}

      {lead.nonStrategicFlag && (
        <Callout kind="warning" label="Non-strategic">
          <strong>{STRINGS.assessment.nonStrategicBanner}</strong>
          {lead.nonStrategicApprovalUserId && (
            <p className="text-sm mt-1">Approved · {lead.nonStrategicApprovalReason}</p>
          )}
        </Callout>
      )}

      <QualificationCard
        leadId={lead.id}
        canEdit={canEditLead}
        // v3.3.18 — pass intake fields so the scorecard can render the
        // derived per-service fit row alongside the manual dimensions.
        fitContext={{
          industry: lead.industry,
          seatCount: lead.seatCount,
          siteCount: lead.siteCount,
          complianceDrivers: lead.complianceDrivers,
          currentMspName: lead.currentMspName,
          currentMspSatisfaction: lead.currentMspSatisfaction,
          interestedServices: lead.interestedServices ?? [],
          currentPhoneSystem: lead.currentPhoneSystem,
          currentPhonePainPoint: lead.currentPhonePainPoint,
          currentAccessControl: lead.currentAccessControl,
          currentAccessDoorCount: lead.currentAccessDoorCount,
          currentVideoSurveillance: lead.currentVideoSurveillance,
          currentVideoCameraCount: lead.currentVideoCameraCount,
          cablingStatus: lead.cablingStatus,
          expansionPlans: lead.expansionPlans,
          aiAdvisoryInterest: lead.aiAdvisoryInterest,
        }}
      />

      <PreSaleAssessmentPanel
        leadId={lead.id}
        dealKind={lead.dealKind}
        canEdit={canEditLead}
        canRunDiscovery={can(session.user.role, "discovery:edit")}
      />

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
          canEdit={canEditLead}
        />
      )}

      <HandoffCard
        leadId={lead.id}
        role={session.user.role}
        hasCustomer={Boolean(existingCustomer)}
      />

      <LeadTabs
        lead={lead as never}
        canEdit={canEditLead}
        auditLogs={auditLogs}
      />
    </DetailPage>
  );
}

function ScoreTile({
  label,
  value,
  primary,
  override,
  derived,
}: {
  label: string;
  value: number;
  primary?: boolean;
  override?: React.ReactNode;
  /** v3.3.21 — when true, render a small "(estimated)" tag so the rep
   *  knows the value is from intake + qualification math, not a
   *  legacy MSP-Fit Assessment submission. */
  derived?: boolean;
}) {
  if (primary) {
    // Tone the big number against the dark navy tile so the score reads at a
    // glance: green ≥ 70, amber ≥ 40, red below.
    const toneClass =
      value >= 70 ? "text-emerald-300"
      : value >= 40 ? "text-amber-300"
      : "text-rose-300";
    const pillClass =
      value >= 70 ? "bg-emerald-400/15 text-emerald-200 border-emerald-300/30"
      : value >= 40 ? "bg-amber-400/15 text-amber-200 border-amber-300/30"
      : "bg-rose-400/15 text-rose-200 border-rose-300/30";
    const pillLabel = value >= 70 ? "Strong" : value >= 40 ? "Marginal" : "Weak";
    return (
      <div className="rounded-xl bg-gtn-navy text-white p-4 md:p-5 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-gtn-purple/30 pointer-events-none" />
        <div className="relative flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-white/80 font-semibold inline-flex items-center gap-1.5">
            {label}
            {derived && <span className="text-[9px] font-normal text-white/60 normal-case tracking-normal">(estimated)</span>}
          </p>
          {override}
        </div>
        <div className="relative mt-2 flex items-baseline gap-3">
          <p className={`ui-stat text-4xl tabular ${toneClass}`}>{formatScore(value)}</p>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pillClass}`}>
            {pillLabel}
          </span>
        </div>
        {derived && (
          <p className="relative text-[10px] text-white/60 mt-1.5">From intake + qualification — run the MSP-Fit assessment for a calibrated score.</p>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="ui-label inline-flex items-center gap-1.5">
          {label}
          {derived && <span className="text-[9px] font-normal text-ink-muted normal-case tracking-normal">(estimated)</span>}
        </p>
        {override}
      </div>
      <div className="mt-2.5 flex items-baseline gap-3">
        <p className="ui-stat text-3xl">{formatScore(value)}</p>
        <ScoreBadge score={value} />
      </div>
    </div>
  );
}
