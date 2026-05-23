import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { STRINGS } from "@/lib/strings";
import { scoreBadgeClass, formatScore } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeaderBand } from "@/components/brand";
import { StageTimeline } from "@/components/process/StageTimeline";
import { LeadTabs } from "./LeadTabs";
import { PricingCard } from "./PricingCard";
import { QualificationCard } from "./QualificationCard";
import { CloseDealButtons } from "./CloseDealButtons";
import { HandoffCard } from "./HandoffCard";
import { ScoreOverrideButton } from "./ScoreOverrideButton";
import { DeleteLeadButton } from "./DeleteLeadButton";

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

  const auditLogs = can(session.user.role, "audit:view")
    ? await prisma.auditLog.findMany({
        where: { entityId: id },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
        take: 50,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeaderBand pageTitle={`Lead · ${lead.businessName}`} />
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

      <PricingCard
        leadId={lead.id}
        role={session.user.role}
        suggestedBundle={lead.suggestedBundle}
        seatCount={lead.seatCount}
      />

      <HandoffCard leadId={lead.id} role={session.user.role} />

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
