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
  complianceDrivers: string[];
  currentMspName: string | null;
  currentMspSatisfaction: string;
  cyberInsuranceRenewalDate: Date | null;
  activities: Array<{ id: string; type: ActivityType; subject: string; body: string | null; createdAt: Date; outcome: ActivityOutcome | null; nextAction: string | null; nextActionDueAt: Date | null; actor: { name: string } }>;
  notes: Array<{ id: string; body: string; pinned: boolean; createdAt: Date; actor: { name: string } }>;
  // v3.3.10 — research-tab cards persisted on the lead
  researchFitSignals: string[];
  researchSuggestedQuestions: string[];
  researchRisks: string[];
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
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-3">Contact</h3>
        <dl className="text-sm space-y-2">
          <Row k="Primary contact" v={lead.primaryContactName} />
          <Row k="Title" v={lead.primaryContactTitle} />
          <Row k="Email" v={lead.primaryContactEmail} />
          <Row k="Phone" v={lead.primaryContactPhone} />
          <Row k="Exec sponsor" v={lead.executiveSponsorName} />
        </dl>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-3">Business</h3>
        <dl className="text-sm space-y-2">
          <Row k="Industry" v={lead.industry.replace(/_/g, " ")} />
          <Row k="Seats" v={lead.seatCount} />
          <Row k="Sites" v={lead.siteCount} />
          <Row k="Address" v={[lead.addressCity, lead.addressState, lead.addressZip].filter(Boolean).join(", ")} />
          <Row k="Website" v={lead.websiteUrl} />
        </dl>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-3">Compliance + MSP</h3>
        <dl className="text-sm space-y-2">
          <Row k="Compliance" v={lead.complianceDrivers.join(", ")} />
          <Row k="Current MSP" v={lead.currentMspName} />
          <Row k="MSP satisfaction" v={lead.currentMspSatisfaction} />
          <Row k="Cyber insurance" v={lead.cyberInsuranceRenewalDate ? format(new Date(lead.cyberInsuranceRenewalDate), "PPP") : null} />
        </dl>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold text-gtn-navy mb-3">Notes</h3>
        <QuickNoteComposer leadId={lead.id} />
        {lead.notes.length === 0 ? (
          <p className="text-sm text-gtn-grey-2 mt-4">No notes yet.</p>
        ) : (
          <ul className="space-y-3 mt-4">
            {lead.notes.slice(0, 5).map((n) => (
              <li key={n.id} className="text-sm">
                {n.pinned && <span className="text-[10px] uppercase font-semibold text-gtn-purple mr-2">Pinned</span>}
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-gtn-grey-3 mt-1">{n.actor.name} · {format(new Date(n.createdAt), "PPp")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gtn-grey-2">{k}</dt>
      <dd className="text-gtn-navy text-right">{String(v)}</dd>
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
        toast.success("Claude summary ready");
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
              {summarizing ? "Summarizing…" : "Summarize with Claude"}
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
        placeholder="Click 'Gather research' to scrape website/LinkedIn/Google, then 'Summarize with Claude' for a tight briefing."
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
          emptyHint="Risks Claude surfaces — or add your own."
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
