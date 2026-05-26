"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ActivityType, ActivityOutcome } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FilesTab } from "./FilesTab";
import { ObjectionsTab } from "./ObjectionsTab";
import { DocumentsPanel } from "@/app/(app)/accounts/[id]/DocumentsPanel";
import { ProposalPanel } from "./ProposalPanel";
// v3.3.16 — per-service fit derivation for the Overview ribbon
import { computeAllServiceFits } from "@/lib/scoring/service-fit";

type Lead = {
  id: string;
  industry: string;
  seatCount: number | null;
  siteCount: number;
  addressCity: string | null;
  addressState: string | null;
  addressZip: string | null;
  websiteUrl: string | null;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  executiveSponsorName: string | null;
  executiveSponsorTitle: string | null;
  complianceDrivers: string[];
  currentMspName: string | null;
  currentMspSatisfaction: string;
  cyberInsuranceRenewalDate: Date | null;
  // v3.3.11 — multi-service intake
  interestedServices: string[];
  currentPhoneSystem: string | null;
  currentPhonePainPoint: string | null;
  currentAccessControl: string | null;
  currentAccessDoorCount: number | null;
  currentVideoSurveillance: string | null;
  currentVideoCameraCount: number | null;
  cablingStatus: string | null;
  expansionPlans: string | null;
  aiAdvisoryInterest: string | null;
  activities: Array<{ id: string; type: ActivityType; subject: string; body: string | null; createdAt: Date; outcome: ActivityOutcome | null; nextAction: string | null; nextActionDueAt: Date | null; actor: { name: string } }>;
  notes: Array<{ id: string; body: string; pinned: boolean; createdAt: Date; actor: { name: string } }>;
  // v3.3.10 — research-tab cards persisted on the lead
  researchFitSignals: string[];
  researchSuggestedQuestions: string[];
  researchRisks: string[];
  // v3.3.16 — overview-tab surface
  servicesScore: number;
  customerScore: number;
  dealQualityScore: number;
  pipelineStage: string;
  expectedCloseDate: Date | null;
  attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    publicUrl: string;
    category: string | null;
    createdAt: Date;
    uploadedBy: { name: string };
  }>;
  qualification: {
    total: number;
    verdict: string | null;
    scoredAt: Date | null;
  } | null;
  // v3.3.21 — richer Overview cards
  businessName: string;
  dbaName: string | null;
  subindustry: string | null;
  addressStreet: string | null;
  source: string;
  dealKind: string;
  dealLineItems: unknown;
  triggerEvent: string | null;
  triggerEventNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner: { id: string; name: string | null; email: string };
  assessments: Array<{ id: string; status: string; createdAt: Date; completedAt: Date | null; createdBy: { name: string } }>;
  preSaleAssessments: Array<{
    id: string;
    kind: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    scorecard: unknown;
    createdBy: { name: string };
  }>;
  serviceMatches: Array<{ id: string; serviceLine: string; fitScore: number; reasoning: string; recommended: boolean }>;
  researchSummary: string | null;
  researchArtifacts: Array<{ id: string; type: string; sourceUrl: string | null; createdAt: Date }>;
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  createdAt: Date;
  before: unknown;
  after: unknown;
  actor: { name: string } | null;
};

const TABS = ["Overview", "Research", "Activity", "Assessment", "Proposal", "Objections", "Files", "Signed Docs", "Audit"] as const;

export function LeadTabs({
  lead,
  canEdit,
  auditLogs,
}: {
  lead: Lead;
  canEdit: boolean;
  auditLogs: AuditEntry[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  return (
    <div>
      <div className="border-b border-gtn-lavender-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "px-4 py-3 text-sm font-semibold border-b-2 border-gtn-navy text-gtn-navy"
                  : "px-4 py-3 text-sm text-gtn-grey-2 hover:text-gtn-navy"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "Overview" && <OverviewTab lead={lead} />}
        {tab === "Research" && <ResearchTab lead={lead} canEdit={canEdit} />}
        {tab === "Activity" && <ActivityTab lead={lead} canEdit={canEdit} />}
        {tab === "Assessment" && <AssessmentTab lead={lead} />}
        {tab === "Proposal" && <ProposalPanel leadId={lead.id} canEdit={canEdit} />}
        {tab === "Objections" && <ObjectionsTab leadId={lead.id} canEdit={canEdit} />}
        {tab === "Files" && <FilesTab leadId={lead.id} />}
        {tab === "Signed Docs" && <DocumentsPanel scope="lead" parentId={lead.id} />}
        {tab === "Audit" && <AuditTab entries={auditLogs} />}
      </div>
    </div>
  );
}

function OverviewTab({ lead }: { lead: Lead }) {
  const hasMultiServiceSignal =
    (lead.interestedServices?.length ?? 0) > 0 ||
    lead.currentPhoneSystem ||
    lead.currentPhonePainPoint ||
    lead.currentAccessControl ||
    lead.currentVideoSurveillance ||
    lead.cablingStatus ||
    lead.expansionPlans ||
    lead.aiAdvisoryInterest;

  // v3.3.16 — derive per-service fit at render time. No DB writes; the
  // input fields are already on the lead from intake + qualification.
  const fitInput: import("@/lib/scoring/service-fit").FitInput = {
    industryFit: 0, sizeFit: 0, geography: 0, growthPosture: 0,
    authority: 0, budget: 0, timeline: 0, complianceDriver: 0,
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
  // If qualification scored, blend in those dims for better signal.
  if (lead.qualification) {
    // Type cast through unknown — qualification is JSON-shaped on Lead include
    const q = lead.qualification as unknown as {
      industryFit?: number; sizeFit?: number; geography?: number; growthPosture?: number;
      authority?: number; budget?: number; timeline?: number; complianceDriver?: number;
    };
    Object.assign(fitInput, {
      industryFit: q.industryFit ?? 0, sizeFit: q.sizeFit ?? 0,
      geography: q.geography ?? 0, growthPosture: q.growthPosture ?? 0,
      authority: q.authority ?? 0, budget: q.budget ?? 0,
      timeline: q.timeline ?? 0, complianceDriver: q.complianceDriver ?? 0,
    });
  }
  const fits = computeAllServiceFits(fitInput);
  const topFits = fits.slice(0, 4);
  const weakFits = fits.slice().reverse().filter((f) => f.band === "weak").slice(0, 2);

  // Activity pulse
  const lastActivity = lead.activities[0];
  const daysSince = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.createdAt).getTime()) / 86400000)
    : null;
  const recentActivityCount = lead.activities.filter(
    (a) => Date.now() - new Date(a.createdAt).getTime() < 30 * 86400000,
  ).length;

  // Attachments — group by category for the at-a-glance card
  const imageAttachments = lead.attachments
    .filter((a) => a.contentType.startsWith("image/"))
    .slice(0, 6);
  const attachmentCounts = lead.attachments.reduce<Record<string, number>>((m, a) => {
    const key = a.category ?? "uncategorized";
    m[key] = (m[key] ?? 0) + 1;
    return m;
  }, {});
  const attachmentTopCategories = Object.entries(attachmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-4">

      {/* Per-service fit ribbon — shows which services this lead is best
          for. Helps reps lead with the right line. */}
      <Card>
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gtn-navy">Best service fits for this lead</h3>
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Per-service 0-100 score derived from industry, size, intake signals, and qualification.
              A lead can score great for IT but weak for VoIP — lead with the strong ones.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {topFits.map((f) => <ServiceFitTile key={f.serviceLine} fit={f} />)}
        </div>
        {weakFits.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gtn-lavender-2">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-grey-2 mb-1.5">
              Weak fits — skip or de-emphasize
            </p>
            <div className="flex flex-wrap gap-1.5">
              {weakFits.map((f) => (
                <span key={f.serviceLine} className="inline-flex items-center gap-1.5 rounded-full bg-gtn-lavender text-gtn-grey-2 px-2 py-0.5 text-[11px] font-semibold">
                  {f.label}
                  <span className="text-[10px] text-gtn-grey-3 tabular">{f.score}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Activity pulse + qualification verdict + paperwork — short status row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <p className="ui-label mb-1">Pipeline + close</p>
          <p className="text-sm font-semibold text-gtn-navy capitalize">
            {lead.pipelineStage.replace(/_/g, " ").toLowerCase()}
          </p>
          <p className="text-xs text-gtn-grey-2 mt-1">
            {lead.expectedCloseDate
              ? `Expected close ${format(new Date(lead.expectedCloseDate), "MMM d, yyyy")}`
              : "No close date set"}
          </p>
        </Card>
        <Card>
          <p className="ui-label mb-1">Activity pulse</p>
          <p className="text-sm font-semibold text-gtn-navy">
            {lastActivity ? `${daysSince ?? 0}d since last touch` : "No activity logged"}
          </p>
          <p className="text-xs text-gtn-grey-2 mt-1">
            {recentActivityCount} event{recentActivityCount === 1 ? "" : "s"} in last 30 days
          </p>
        </Card>
        <Card>
          <p className="ui-label mb-1">Qualification</p>
          {lead.qualification && lead.qualification.scoredAt ? (
            <>
              <p className="text-sm font-semibold text-gtn-navy">
                {lead.qualification.total}/100 · {(lead.qualification.verdict ?? "—").replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-xs text-gtn-grey-2 mt-1">
                Scored {format(new Date(lead.qualification.scoredAt), "MMM d")}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gtn-grey-2">Not scored yet</p>
              <p className="text-xs text-gtn-grey-2 mt-1">Fill the scorecard on this page</p>
            </>
          )}
        </Card>
      </div>

      {/* Research signals snippet — only when we have data */}
      {(lead.researchFitSignals.length > 0 || lead.researchSuggestedQuestions.length > 0 || lead.researchRisks.length > 0) && (
        <Card>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gtn-navy">Research signals</h3>
            <p className="text-[11px] text-gtn-grey-2">Edit on the Research tab</p>
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-green mb-1">
                Fit signals ({lead.researchFitSignals.length})
              </p>
              <ul className="space-y-0.5 text-xs">
                {lead.researchFitSignals.slice(0, 4).map((s, i) => (
                  <li key={i} className="text-gtn-navy">• {s}</li>
                ))}
                {lead.researchFitSignals.length > 4 && (
                  <li className="text-gtn-grey-2">+{lead.researchFitSignals.length - 4} more</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-purple mb-1">
                Ask them ({lead.researchSuggestedQuestions.length})
              </p>
              <ul className="space-y-0.5 text-xs">
                {lead.researchSuggestedQuestions.slice(0, 4).map((s, i) => (
                  <li key={i} className="text-gtn-navy">• {s}</li>
                ))}
                {lead.researchSuggestedQuestions.length > 4 && (
                  <li className="text-gtn-grey-2">+{lead.researchSuggestedQuestions.length - 4} more</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide font-semibold text-gtn-amber mb-1">
                Risks ({lead.researchRisks.length})
              </p>
              <ul className="space-y-0.5 text-xs">
                {lead.researchRisks.slice(0, 4).map((s, i) => (
                  <li key={i} className="text-gtn-navy">• {s}</li>
                ))}
                {lead.researchRisks.length > 4 && (
                  <li className="text-gtn-grey-2">+{lead.researchRisks.length - 4} more</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Attachments at a glance — image strip + category counts */}
      {lead.attachments.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-gtn-navy">
              Site files + media ({lead.attachments.length})
            </h3>
            <p className="text-[11px] text-gtn-grey-2">Open the Files tab to manage</p>
          </div>
          {imageAttachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {imageAttachments.map((a) => (
                <a key={a.id} href={a.publicUrl} target="_blank" rel="noreferrer" className="flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.publicUrl}
                    alt={a.filename}
                    title={a.filename}
                    className="h-20 w-28 object-cover rounded border border-gtn-lavender-2"
                  />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {attachmentTopCategories.map(([cat, n]) => (
              <span key={cat} className="inline-block rounded-full bg-gtn-lavender text-gtn-navy px-2 py-0.5 text-[11px] font-semibold capitalize">
                {cat.replace(/_/g, " ")} · {n}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* v3.3.21 — Original detail grid expanded so reps see every signal
          we collect, not just the 4-row legacy dl. */}
      <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gtn-navy">Contact + ownership</h3>
        </div>
        <dl className="text-sm space-y-2">
          <Row k="Primary contact" v={[lead.primaryContactName, lead.primaryContactTitle].filter(Boolean).join(" · ") || null} />
          <Row
            k="Email"
            v={lead.primaryContactEmail ? (
              <a className="text-gtn-purple hover:underline break-all" href={`mailto:${lead.primaryContactEmail}`}>{lead.primaryContactEmail}</a>
            ) : null}
          />
          <Row
            k="Phone"
            v={lead.primaryContactPhone ? (
              <a className="text-gtn-purple hover:underline" href={`tel:${lead.primaryContactPhone.replace(/\D/g, "")}`}>{lead.primaryContactPhone}</a>
            ) : null}
          />
          <Row
            k="Exec sponsor"
            v={[lead.executiveSponsorName, lead.executiveSponsorTitle].filter(Boolean).join(" · ") || null}
          />
          <Row
            k="Lead owner"
            v={lead.owner ? `${lead.owner.name ?? lead.owner.email} (${lead.owner.email})` : null}
          />
          <Row k="Lead created" v={format(new Date(lead.createdAt), "MMM d, yyyy")} />
          <Row k="Last updated" v={format(new Date(lead.updatedAt), "MMM d, yyyy")} />
        </dl>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gtn-navy">Business profile</h3>
        </div>
        <dl className="text-sm space-y-2">
          <Row k="Legal name" v={lead.businessName} />
          <Row k="DBA" v={lead.dbaName} />
          <Row
            k="Industry"
            v={[lead.industry.replace(/_/g, " "), lead.subindustry].filter(Boolean).join(" · ")}
          />
          <Row
            k="Size"
            v={[
              lead.seatCount ? `${lead.seatCount} seats` : null,
              `${lead.siteCount} site${lead.siteCount === 1 ? "" : "s"}`,
            ].filter(Boolean).join(" · ")}
          />
          <Row
            k="Address"
            v={
              [lead.addressStreet, lead.addressCity, lead.addressState, lead.addressZip]
                .filter(Boolean).join(", ") || null
            }
          />
          <Row
            k="Website"
            v={lead.websiteUrl ? (
              <a className="text-gtn-purple hover:underline break-all" href={lead.websiteUrl} target="_blank" rel="noreferrer">{lead.websiteUrl}</a>
            ) : null}
          />
          <Row k="Deal kind" v={lead.dealKind.replace(/_/g, " ").toLowerCase()} />
          <Row k="Lead source" v={lead.source.replace(/_/g, " ").toLowerCase()} />
          <Row
            k="Trigger event"
            v={lead.triggerEvent && lead.triggerEvent !== "NONE"
              ? `${lead.triggerEvent.replace(/_/g, " ").toLowerCase()}${lead.triggerEventNote ? ` — ${lead.triggerEventNote.slice(0, 80)}` : ""}`
              : null}
          />
        </dl>
      </Card>
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gtn-navy">Compliance, insurance + current MSP</h3>
        </div>
        <dl className="text-sm space-y-2">
          <Row
            k="Compliance drivers"
            v={
              lead.complianceDrivers.length === 0 ? null :
              <div className="flex flex-wrap gap-1 justify-end">
                {lead.complianceDrivers.map((d) => (
                  <span key={d} className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                    {d.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            }
          />
          <Row k="Current MSP" v={lead.currentMspName} />
          <Row
            k="MSP satisfaction"
            v={
              lead.currentMspSatisfaction === "NONE" ? "No current MSP / unsure" :
              lead.currentMspSatisfaction === "HAPPY" ? "Happy with current MSP" :
              lead.currentMspSatisfaction === "NEUTRAL" ? "Neutral — open to alternatives" :
              lead.currentMspSatisfaction === "LEAVING" ? "Actively leaving current MSP" :
              null
            }
          />
          <Row
            k="Cyber insurance renewal"
            v={(() => {
              if (!lead.cyberInsuranceRenewalDate) return null;
              const d = new Date(lead.cyberInsuranceRenewalDate);
              const days = Math.floor((d.getTime() - Date.now()) / 86400000);
              return `${format(d, "MMM d, yyyy")}${days >= 0 && days <= 120 ? ` · in ${days}d` : days < 0 ? " · past due" : ""}`;
            })()}
          />
        </dl>
      </Card>
      {hasMultiServiceSignal && (
        <Card>
          <h3 className="text-sm font-semibold text-gtn-navy mb-3">Service interests + current stack</h3>
          <dl className="text-sm space-y-2">
            {lead.interestedServices && lead.interestedServices.length > 0 && (
              <Row
                k="Interested in"
                v={
                  <div className="flex flex-wrap gap-1">
                    {lead.interestedServices.map((s) => (
                      <span key={s} className="inline-block rounded-full bg-brand-soft text-gtn-purple px-2 py-0.5 text-[11px] font-semibold capitalize">
                        {s.replace(/_/g, " ").toLowerCase()}
                      </span>
                    ))}
                  </div>
                }
              />
            )}
            <Row k="Phone system" v={lead.currentPhoneSystem} />
            <Row k="Phone pain" v={lead.currentPhonePainPoint} />
            <Row
              k="Access control"
              v={[
                lead.currentAccessControl,
                lead.currentAccessDoorCount != null && lead.currentAccessDoorCount > 0
                  ? `${lead.currentAccessDoorCount} door${lead.currentAccessDoorCount === 1 ? "" : "s"}`
                  : null,
              ].filter(Boolean).join(" · ") || null}
            />
            <Row
              k="Video"
              v={[
                lead.currentVideoSurveillance,
                lead.currentVideoCameraCount != null && lead.currentVideoCameraCount > 0
                  ? `${lead.currentVideoCameraCount} camera${lead.currentVideoCameraCount === 1 ? "" : "s"}`
                  : null,
              ].filter(Boolean).join(" · ") || null}
            />
            <Row k="Cabling" v={lead.cablingStatus} />
            <Row k="Expansion" v={lead.expansionPlans} />
            <Row k="AI advisory" v={lead.aiAdvisoryInterest} />
          </dl>
        </Card>
      )}
      <Card>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gtn-navy">
            Notes
            <span className="ml-2 text-xs font-normal text-gtn-grey-2">
              {lead.notes.length} total · {lead.notes.filter((n) => n.pinned).length} pinned
            </span>
          </h3>
        </div>
        <QuickNoteComposer leadId={lead.id} />
        {lead.notes.length === 0 ? (
          <p className="text-sm text-gtn-grey-2 mt-4">No notes yet — pin a first-impression note as you build context.</p>
        ) : (
          <ul className="space-y-3 mt-4">
            {/* Always show every pinned note first, then up to 4 most-
                recent unpinned. Old slice(0,5) hid pinned ones if the
                rep had logged a flurry of recent unpinned notes. */}
            {[
              ...lead.notes.filter((n) => n.pinned),
              ...lead.notes.filter((n) => !n.pinned).slice(0, 4),
            ].map((n) => (
              <li key={n.id} className="text-sm border-l-2 pl-3 border-gtn-lavender-2">
                {n.pinned && <span className="text-[10px] uppercase font-semibold text-gtn-purple mr-2">Pinned</span>}
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-gtn-grey-3 mt-1">{n.actor.name} · {format(new Date(n.createdAt), "PPp")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>
    </div>
  );
}

/**
 * v3.3.16 — Service-fit tile for the Overview ribbon. Shows label, a
 * 0-100 score in a tinted bar, the band pill, and the top 2 reasons.
 */
function ServiceFitTile({ fit }: { fit: import("@/lib/scoring/service-fit").ServiceFit }) {
  const barClass =
    fit.band === "strong" ? "bg-gtn-green"
    : fit.band === "good" ? "bg-gtn-purple"
    : fit.band === "marginal" ? "bg-gtn-amber"
    : "bg-gtn-grey-3";
  const pillClass =
    fit.band === "strong" ? "bg-gtn-green-bg text-gtn-green"
    : fit.band === "good" ? "bg-brand-soft text-gtn-purple"
    : fit.band === "marginal" ? "bg-amber-100 text-amber-800"
    : "bg-gtn-lavender text-gtn-grey-2";
  return (
    <div className="rounded-lg border border-gtn-lavender-2 bg-white p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gtn-navy truncate">{fit.label}</p>
        <span className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${pillClass}`}>
          {fit.band}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-xl font-mono font-bold text-gtn-navy tabular">{fit.score}</p>
        <p className="text-[10px] text-gtn-grey-2">/100</p>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gtn-lavender overflow-hidden">
        <div className={`h-full ${barClass}`} style={{ width: `${fit.score}%` }} />
      </div>
      {fit.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {fit.reasons.slice(0, 2).map((r, i) => (
            <li key={i} className="text-[11px] text-gtn-grey-2 leading-snug">• {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickNoteComposer({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const clientId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline) {
        const { enqueueNote } = await import("@/lib/offline/note-queue");
        await enqueueNote({ leadId, body: body.trim(), pinned });
        toast.success("Saved offline. Will sync when you're back online.");
        setBody(""); setPinned(false);
        return;
      }
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": clientId },
        body: JSON.stringify({ body: body.trim(), pinned, clientId }),
      });
      if (!res.ok) {
        // Likely transient — queue it
        const { enqueueNote } = await import("@/lib/offline/note-queue");
        await enqueueNote({ leadId, body: body.trim(), pinned });
        toast.success("Queued — will retry when network returns.");
      } else {
        toast.success(pinned ? "Note pinned" : "Note added");
        router.refresh();
      }
      setBody(""); setPinned(false);
    } catch {
      const { enqueueNote } = await import("@/lib/offline/note-queue");
      await enqueueNote({ leadId, body: body.trim(), pinned });
      toast.success("Saved offline. Will sync when you're back online.");
      setBody(""); setPinned(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a quick note… (works offline)"
        rows={3}
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-gtn-grey-2">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-gtn-purple" />
          Pin
        </label>
        <Button type="submit" disabled={!body.trim() || saving} size="sm">
          {saving ? "Saving…" : "Save note"}
        </Button>
      </div>
    </form>
  );
}

function Row({ k, v }: { k: string; v: unknown }) {
  if (v === null || v === undefined || v === "") return null;
  // v3.3.11 — accept React nodes too (e.g. a chip row for interestedServices).
  const isReactNode = typeof v === "object" && v !== null && "$$typeof" in (v as Record<string, unknown>);
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gtn-grey-2 flex-shrink-0">{k}</dt>
      <dd className="text-gtn-navy text-right min-w-0 flex-1">
        {isReactNode ? (v as React.ReactNode) : <span className="whitespace-pre-wrap">{String(v)}</span>}
      </dd>
    </div>
  );
}

function ResearchTab({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(lead.researchSummary ?? "");
  const [saving, setSaving] = useState(false);
  const [gathering, setGathering] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  // v3.3.10 — hydrate the three cards from the lead so they persist across
  // reloads, not just the immediate post-gather toast.
  const [fitSignals, setFitSignals] = useState<string[]>(lead.researchFitSignals ?? []);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(lead.researchSuggestedQuestions ?? []);
  const [risks, setRisks] = useState<string[]>(lead.researchRisks ?? []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          researchSummary: text,
          // v3.3.10 — persist the three cards alongside the prose.
          researchFitSignals: fitSignals,
          researchSuggestedQuestions: suggestedQuestions,
          researchRisks: risks,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Failed to save");
      } else {
        toast.success("Research saved");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function gather() {
    setGathering(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/research/gather`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Gather failed");
      } else {
        const counts = data.sources as Record<string, { ok: boolean; error?: string }>;
        const okCount = Object.values(counts ?? {}).filter((s) => s.ok).length;
        toast.success(`Gathered ${okCount} source(s)`);
        if (data.summary) {
          setText(data.summary);
          setFitSignals(Array.isArray(data.fitSignals) ? data.fitSignals : []);
          setSuggestedQuestions(Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : []);
          setRisks(Array.isArray(data.risks) ? data.risks : []);
        }
        router.refresh();
      }
    } finally {
      setGathering(false);
    }
  }

  async function summarize() {
    setSummarizing(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/research/summarize`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Summarize failed");
      } else {
        setText(data.summary);
        setFitSignals(Array.isArray(data.fitSignals) ? data.fitSignals : []);
        setSuggestedQuestions(Array.isArray(data.suggestedQuestions) ? data.suggestedQuestions : []);
        setRisks(Array.isArray(data.risks) ? data.risks : []);
        toast.success("Gateway AI summary ready");
        router.refresh();
      }
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">Research summary</h3>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" type="button" onClick={gather} disabled={gathering}>
              {gathering ? "Gathering…" : "Gather research"}
            </Button>
            <Button variant="accent" type="button" onClick={summarize} disabled={summarizing}>
              {summarizing ? "Summarizing…" : "Summarize with Gateway AI"}
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-gtn-grey-2 mb-3">
        Pulled from website + LinkedIn + Google. You can edit manually.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canEdit}
        rows={10}
        placeholder="Click 'Gather research' to scrape website/LinkedIn/Google, then 'Summarize with Gateway AI' for a tight briefing."
      />
      {canEdit && (
        <div className="mt-3 flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save research"}</Button>
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-3 gap-3">
        <ResearchCardEditor
          title="Fit signals"
          tone="success"
          items={fitSignals}
          onChange={setFitSignals}
          placeholder="Why they're a fit — e.g. 'in a Gateway priority vertical'"
          canEdit={canEdit}
          emptyHint="Click Gather research, or add manually."
        />
        <ResearchCardEditor
          title="Ask them"
          tone="info"
          items={suggestedQuestions}
          onChange={setSuggestedQuestions}
          placeholder="What to ask on the next call — e.g. 'how many sites?'"
          canEdit={canEdit}
          emptyHint="Discovery questions appear here after Gather research."
        />
        <ResearchCardEditor
          title="Risks"
          tone="warning"
          items={risks}
          onChange={setRisks}
          placeholder="Red flag — e.g. 'no compelling event'"
          canEdit={canEdit}
          emptyHint="Risks Gateway AI surfaces — or add your own."
        />
      </div>

      {lead.researchArtifacts.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-2">Artifacts</h4>
          <ul className="text-sm space-y-2">
            {lead.researchArtifacts.map((a) => (
              <li key={a.id} className="border-t border-gtn-lavender-2 pt-2 first:border-0 first:pt-0">
                <span className="font-mono text-xs text-gtn-grey-2 mr-2">{a.type}</span>
                {a.sourceUrl ? (
                  <a className="text-gtn-purple underline" href={a.sourceUrl} target="_blank" rel="noreferrer">{a.sourceUrl}</a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * v3.3.10 — Editable card for one of the three persisted research lists
 * (Fit signals / Ask them / Risks). Owns its own input draft + buttons
 * for add/remove. State is lifted to ResearchTab so Save research can
 * PATCH all three lists in one call alongside the prose.
 */
function ResearchCardEditor({
  title,
  tone,
  items,
  onChange,
  placeholder,
  canEdit,
  emptyHint,
}: {
  title: string;
  tone: "success" | "info" | "warning";
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  canEdit: boolean;
  emptyHint: string;
}) {
  const [draft, setDraft] = useState("");
  const calloutClass =
    tone === "success" ? "gtn-callout gtn-callout--success"
    : tone === "info" ? "gtn-callout gtn-callout--info"
    : "gtn-callout gtn-callout--warning";
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...items, v.slice(0, 500)]);
    setDraft("");
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  return (
    <div className={calloutClass}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-xs uppercase tracking-wide font-semibold">{title}</p>
        <span className="text-[10px] text-gtn-grey-2 tabular">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2 italic">{emptyHint}</p>
      ) : (
        <ul className="text-sm space-y-1">
          {items.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-gtn-grey-3 mt-0.5">•</span>
              <span className="flex-1 break-words">{s}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove "${s.slice(0, 40)}"`}
                  className="text-gtn-grey-3 hover:text-gtn-red text-xs flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder={placeholder}
            className="flex-1 h-7 rounded border border-gtn-lavender-2 px-2 text-xs bg-white focus:outline-none focus:border-gtn-purple"
            maxLength={500}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="h-7 px-2 rounded bg-gtn-purple text-white text-xs disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityTab({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>(ActivityType.NOTE);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, subject, body,
          nextAction: nextAction || undefined,
          nextActionDueAt: nextActionDate ? new Date(nextActionDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add activity");
      } else {
        toast.success("Activity added");
        setSubject(""); setBody(""); setNextAction(""); setNextActionDate("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <form onSubmit={add} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ActivityType)}
                  className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                >
                  {(["NOTE", "CALL", "EMAIL", "MEETING", "RESEARCH", "FOLLOW_UP_SCHEDULED"] as ActivityType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Subject *</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={300} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Next action (optional)</Label>
                <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Follow up Tuesday" />
              </div>
              <div className="space-y-2">
                <Label>Next action due</Label>
                <Input type="datetime-local" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !subject.trim()}>{saving ? "Adding…" : "Add activity"}</Button>
            </div>
          </form>
        </Card>
      )}

      <ul className="space-y-3">
        {lead.activities.map((a) => (
          <li key={a.id} className="gtn-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gtn-navy">{a.subject}</p>
              <span className="text-xs text-gtn-grey-3 font-mono">{a.type}</span>
            </div>
            {a.body && <p className="text-sm text-gtn-grey-2 mt-1 whitespace-pre-wrap">{a.body}</p>}
            {a.nextAction && (
              <p className="text-xs text-gtn-purple mt-2">
                Next: {a.nextAction}{a.nextActionDueAt ? ` · ${format(new Date(a.nextActionDueAt), "PPp")}` : ""}
              </p>
            )}
            <p className="text-xs text-gtn-grey-3 mt-2">{a.actor.name} · {format(new Date(a.createdAt), "PPp")}</p>
          </li>
        ))}
        {lead.activities.length === 0 && (
          <li className="text-sm text-gtn-grey-2 text-center py-8">No activity yet.</li>
        )}
      </ul>
    </div>
  );
}

function AssessmentTab({ lead }: { lead: Lead }) {
  const hasAny = lead.assessments.length > 0 || lead.preSaleAssessments.length > 0;
  return (
    <Card>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gtn-navy">Assessments</h3>
        <div className="flex gap-2">
          <SendLinkButton leadId={lead.id} />
          <Button asChild>
            <a href={`/leads/${lead.id}/assessment/start`}>Run in person</a>
          </Button>
        </div>
      </div>
      {!hasAny ? (
        <p className="text-sm text-gtn-grey-2">No assessments yet.</p>
      ) : (
        <ul className="space-y-2">
          {lead.assessments.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-t border-gtn-lavender-2 pt-3 first:border-0 first:pt-0">
              <div>
                <p className="text-sm font-medium">MSP Fit · {a.status}</p>
                <p className="text-xs text-gtn-grey-2">
                  {a.createdBy.name} · {format(new Date(a.createdAt), "PPp")}
                </p>
              </div>
              {a.status !== "COMPLETED" && (
                <a className="text-sm text-gtn-purple underline" href={`/assessment/${a.id}`}>Continue</a>
              )}
              {a.status === "COMPLETED" && (
                <a className="text-sm text-gtn-purple underline" href={`/assessment/${a.id}/result`}>View</a>
              )}
            </li>
          ))}
          {lead.preSaleAssessments.map((d) => {
            const sc = (d.scorecard ?? null) as
              | { summary?: string; coveragePct?: number; risks?: Array<{ severity?: string }>; recommendedLineItems?: unknown[] }
              | null;
            const riskCount = Array.isArray(sc?.risks) ? sc!.risks!.length : 0;
            const lineItemCount = Array.isArray(sc?.recommendedLineItems) ? sc!.recommendedLineItems!.length : 0;
            return (
              <li key={d.id} className="flex items-start justify-between gap-3 border-t border-gtn-lavender-2 pt-3 first:border-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {d.kind.replace(/_/g, " ")} · {d.status}
                  </p>
                  <p className="text-xs text-gtn-grey-2">
                    {d.createdBy.name} · {format(new Date(d.createdAt), "PPp")}
                    {d.completedAt && ` · completed ${format(new Date(d.completedAt), "MMM d")}`}
                  </p>
                  {d.status === "COMPLETED" && sc && (
                    <p className="text-xs text-gtn-grey-2 mt-1">
                      {typeof sc.coveragePct === "number" && <>Coverage {sc.coveragePct}% · </>}
                      {riskCount > 0 && <>{riskCount} risk{riskCount === 1 ? "" : "s"} · </>}
                      {lineItemCount > 0 && <>{lineItemCount} recommended line item{lineItemCount === 1 ? "" : "s"}</>}
                    </p>
                  )}
                </div>
                <a className="text-sm text-gtn-purple underline whitespace-nowrap" href={`/leads/${lead.id}/discovery/${d.id}`}>
                  {d.status === "COMPLETED" ? "View result" : "Open"}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {lead.serviceMatches.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold mb-3">Service matches</h4>
          <ul className="space-y-2">
            {lead.serviceMatches
              .sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.fitScore - a.fitScore)
              .map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 border-t border-gtn-lavender-2 pt-3 first:border-0 first:pt-0">
                  <div>
                    <p className="text-sm font-medium text-gtn-navy">
                      {m.serviceLine.replace(/_/g, " ")}
                      {m.recommended && <span className="ml-2 text-xs text-gtn-green">recommended</span>}
                    </p>
                    <p className="text-xs text-gtn-grey-2">{m.reasoning}</p>
                  </div>
                  <span className="font-mono text-sm text-gtn-navy">+{m.fitScore}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SendLinkButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function send() {
    setSending(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          mode: "SELF_SERVICE_LINK",
          respondentEmail: email,
          respondentName: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
      } else {
        setLink(data.publicLink);
        toast.success(data.emailSent ? "Link emailed" : "Link created (email not delivered — copy below)");
        router.refresh();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
        {open ? "Cancel" : "Send link"}
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-10 w-80 gtn-card p-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Respondent email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Respondent name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={send} disabled={sending || !email} className="w-full">
            {sending ? "Sending…" : "Generate + email link"}
          </Button>
          {link && (
            <div className="space-y-1">
              <Label className="text-xs">Link (copy + paste if needed)</Label>
              <div className="flex gap-1">
                <Input readOnly value={link} className="text-xs font-mono" />
                <Button variant="secondary" type="button" onClick={() => { void navigator.clipboard.writeText(link); toast.success("Copied"); }}>Copy</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function AuditTab({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gtn-grey-2">Audit visibility is restricted to COO and Superadmin.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-3">Audit trail</h3>
      <ul className="text-sm space-y-3">
        {entries.map((e) => (
          <li key={e.id} className="border-t border-gtn-lavender-2 pt-3 first:border-0 first:pt-0">
            <p>
              <span className="gtn-code-pill mr-2">{e.action}</span>
              <span className="font-medium">{e.entityType}</span>
              <span className="text-gtn-grey-2"> by {e.actor?.name ?? "system"}</span>
            </p>
            <p className="text-xs text-gtn-grey-3 mt-1">{format(new Date(e.createdAt), "PPp")}</p>
            {(Boolean(e.before) || Boolean(e.after)) && (
              <pre className="mt-2 text-xs bg-gtn-lavender p-2 rounded overflow-x-auto">
                {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
