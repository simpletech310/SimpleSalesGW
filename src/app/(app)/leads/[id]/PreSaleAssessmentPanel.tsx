"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ClipboardCheck, Loader2, Plus, Sparkles, Copy } from "lucide-react";
import { DealKind, DiscoveryKind, DiscoveryStatus, Role } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { discoveryTitle, isPreSaleKind } from "@/lib/discovery/banks";
import type { LineItem } from "@/lib/pricing/deal-kinds";

/**
 * v2.17 — Pre-sale technical assessment panel on the Lead detail page.
 *
 * - Lists existing pre-sale DiscoveryAssessments (leadId-scoped) with status
 * - "Request vCIO scoping" button → modal with 4 kind options
 * - When an assessment is COMPLETED with recommendedLineItems, shows an
 *   "Adopt N items into quote" button that merges into Lead.dealLineItems
 */

const REQUESTABLE_KINDS: ReadonlyArray<{ kind: DiscoveryKind; label: string; tagline: string }> = [
  { kind: "SITE_SURVEY", label: "IT Site Survey", tagline: "Full IT discovery — sites, networks, identity, endpoints, security." },
  { kind: "VOICE_SCOPING", label: "Voice / Phone scoping", tagline: "Lightweight ~25 Q to size extensions, hardware, install labor." },
  { kind: "CCTV_SCOPING", label: "CCTV / video scoping", tagline: "Camera count, retention, NVR sizing, remote viewing." },
  { kind: "ACCESS_CONTROL_SCOPING", label: "Access control scoping", tagline: "Door count, credentials, software licensing." },
];

type AssessmentRow = {
  id: string;
  kind: DiscoveryKind;
  status: DiscoveryStatus;
  startedAt: string | null;
  completedAt: string | null;
  scorecard: { recommendedLineItems?: LineItem[] } | null;
  createdBy: { name: string };
};

export function PreSaleAssessmentPanel({
  leadId,
  dealKind,
  canEdit,
  canRunDiscovery,
}: {
  leadId: string;
  dealKind: DealKind;
  canEdit: boolean;
  /** True for VCIO + SUPERADMIN — they can complete (run) the assessment. */
  canRunDiscovery: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<AssessmentRow[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState<DiscoveryKind | null>(null);
  const [adopting, setAdopting] = useState<string | null>(null);
  // v2.20 — Pre-sale narrative state
  const [narratingId, setNarratingId] = useState<string | null>(null);
  const [narratives, setNarratives] = useState<Record<string, {
    narrative: string;
    included: string[];
    notIncluded: string[];
    nextStep: string;
  }>>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/discovery`);
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.assessments);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function request(kind: DiscoveryKind) {
    setCreating(kind);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success("Request sent — vCIO will see it on /notifications.");
      setPicking(false);
      await refresh();
      router.refresh();
    } finally {
      setCreating(null);
    }
  }

  async function adoptIntoQuote(a: AssessmentRow) {
    const lineItems = a.scorecard?.recommendedLineItems ?? [];
    if (lineItems.length === 0) {
      toast.message("No recommended items to adopt.");
      return;
    }
    setAdopting(a.id);
    try {
      // Fetch current Lead.dealLineItems so we can merge instead of overwrite.
      const leadRes = await fetch(`/api/leads/${leadId}`);
      const leadData = await leadRes.json();
      const existingLines: LineItem[] = (leadData?.lead?.dealLineItems as { lines?: LineItem[] })?.lines ?? [];

      const merged = [...existingLines, ...lineItems];
      const patchRes = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealLineItems: { lines: merged } }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        toast.error(patchData?.error ?? "Could not adopt items");
        return;
      }
      toast.success(`Added ${lineItems.length} item${lineItems.length === 1 ? "" : "s"} to the quote.`);
      router.refresh();
    } finally {
      setAdopting(null);
    }
  }

  async function generateNarrative(assessmentId: string) {
    setNarratingId(assessmentId);
    try {
      const res = await fetch(`/api/leads/${leadId}/discovery/${assessmentId}/narrative`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Narrative generation failed");
        return;
      }
      setNarratives((cur) => ({
        ...cur,
        [assessmentId]: {
          narrative: data.narrative ?? "",
          included: data.included ?? [],
          notIncluded: data.notIncluded ?? [],
          nextStep: data.nextStep ?? "",
        },
      }));
      toast.success("Narrative ready");
      // v2.20.3 — refresh server components so the AI usage meter updates
      router.refresh();
    } catch {
      toast.error("Narrative generation failed");
    } finally {
      setNarratingId(null);
    }
  }

  async function copyNarrative(assessmentId: string) {
    const n = narratives[assessmentId];
    if (!n) return;
    const text = [
      n.narrative,
      "",
      "What's included:",
      ...n.included.map((s) => `  • ${s}`),
      "",
      "What's not included:",
      ...n.notIncluded.map((s) => `  • ${s}`),
      "",
      n.nextStep ? `Next step: ${n.nextStep}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
  }

  if (items === null) {
    return (
      <Card>
        <p className="text-sm text-gtn-grey-2">Loading pre-sale assessments…</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Pre-sale technical assessment</h3>
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            Request vCIO scoping before the deal closes. Findings auto-fill the quote when complete.
          </p>
        </div>
        {canEdit && !picking && (
          <Button variant="secondary" size="sm" onClick={() => setPicking(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Request vCIO scoping
          </Button>
        )}
      </div>

      {picking && (
        <div className="border border-gtn-lavender-2 rounded-md p-3 mb-3 space-y-2">
          <p className="text-xs text-gtn-grey-2 mb-2">What kind of scoping does this deal need?</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {REQUESTABLE_KINDS.map((k) => (
              <button
                type="button"
                key={k.kind}
                disabled={creating != null}
                onClick={() => request(k.kind)}
                className="text-left rounded border border-gtn-lavender-2 p-3 hover:border-gtn-purple/40 hover:bg-gtn-lavender/30 disabled:opacity-60"
              >
                <p className="text-sm font-semibold text-gtn-navy flex items-center gap-2">
                  {creating === k.kind && <Loader2 className="h-3 w-3 animate-spin" />}
                  {k.label}
                </p>
                <p className="text-xs text-gtn-grey-2 mt-0.5">{k.tagline}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="text-xs text-gtn-grey-2 hover:text-gtn-navy mt-1"
          >
            cancel
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gtn-grey-2">
          No pre-sale assessments yet. Click <strong>Request vCIO scoping</strong> if you need help sizing what to quote.
        </p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((a) => {
            const recCount = a.scorecard?.recommendedLineItems?.length ?? 0;
            const isCompleted = a.status === DiscoveryStatus.COMPLETED;
            const showAdopt =
              isCompleted &&
              recCount > 0 &&
              isPreSaleKind(a.kind) &&
              canEdit &&
              dealKind !== DealKind.MANAGED_IT_BUNDLE;
            const showNarrative = isCompleted && canEdit;
            const n = narratives[a.id];
            return (
              <li key={a.id} className="py-3 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-gtn-navy flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      {discoveryTitle(a.kind)}
                    </p>
                    <p className="text-xs text-gtn-grey-3 mt-1">
                      Requested by {a.createdBy.name}
                      {a.completedAt && ` · completed ${format(new Date(a.completedAt), "MMM d")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showAdopt && (
                      <Button
                        size="sm"
                        onClick={() => adoptIntoQuote(a)}
                        disabled={adopting === a.id}
                      >
                        {adopting === a.id ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Adopting…</>
                        ) : (
                          <><ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Adopt {recCount} item{recCount === 1 ? "" : "s"} into quote</>
                        )}
                      </Button>
                    )}
                    {showNarrative && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => generateNarrative(a.id)}
                        disabled={narratingId === a.id}
                      >
                        {narratingId === a.id ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Writing…</>
                        ) : (
                          <><Sparkles className="h-3.5 w-3.5 mr-1" /> {n ? "Regen narrative" : "Generate proposal narrative"}</>
                        )}
                      </Button>
                    )}
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/leads/${leadId}/discovery/${a.id}`}>
                        {isCompleted ? "View result" : canRunDiscovery ? "Continue" : "Open"}
                      </Link>
                    </Button>
                  </div>
                </div>

                {n && (
                  <div className="rounded-md border border-gtn-lavender-2 bg-gtn-lavender/30 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-purple flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" />
                        Customer-facing narrative
                      </p>
                      <Button size="sm" variant="ghost" onClick={() => copyNarrative(a.id)} className="h-7 px-2">
                        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                      </Button>
                    </div>
                    {n.narrative && (
                      <p className="text-sm text-gtn-navy whitespace-pre-wrap">{n.narrative}</p>
                    )}
                    {n.included.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-purple">What&apos;s included</p>
                        <ul className="list-disc list-inside text-sm text-gtn-navy mt-1">
                          {n.included.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {n.notIncluded.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-grey-2">What&apos;s not included</p>
                        <ul className="list-disc list-inside text-sm text-gtn-navy mt-1">
                          {n.notIncluded.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {n.nextStep && (
                      <p className="text-xs text-gtn-grey-2 border-t border-gtn-lavender-2 pt-2">
                        <strong>Next step:</strong> {n.nextStep}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Hint when there's at least one IN_PROGRESS and the viewer is the salesperson */}
      {items.some((a) => a.status !== DiscoveryStatus.COMPLETED) && !canRunDiscovery && (
        <p className="text-xs text-gtn-grey-2 mt-3">
          The vCIO will see this on <strong>/notifications</strong> and run it when convenient.
        </p>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: DiscoveryStatus }) {
  const cls =
    status === DiscoveryStatus.COMPLETED ? "bg-gtn-green-bg text-gtn-green"
      : status === DiscoveryStatus.IN_PROGRESS ? "bg-[#FEF3E2] text-gtn-amber"
      : "bg-gtn-lavender text-gtn-grey-2";
  const label = status === DiscoveryStatus.NOT_STARTED ? "Awaiting vCIO" : status.replace(/_/g, " ");
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {label}
    </span>
  );
}

// Role is imported but unused in the component itself; keep the import for
// potential future role-aware rendering and silence the lint warning.
void Role;
