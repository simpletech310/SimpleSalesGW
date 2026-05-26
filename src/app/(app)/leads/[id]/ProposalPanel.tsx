"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type SowTemplate = {
  id: string;
  name: string;
  bundle: string | null;
  industry: string | null;
};

type Proposal = {
  id: string;
  version: number;
  status: string;
  scopeMarkdown: string;
  deliverablesMarkdown: string;
  timelineMarkdown: string;
  exclusionsMarkdown: string;
  termsMarkdown: string;
  pricingSnapshot: Record<string, unknown>;
  vcioReviewedAt: string | null;
  vcioReviewVerdict: string | null;
  vcioReviewNotes: string | null;
  vcioReviewedBy: { name: string } | null;
  managerReviewedAt: string | null;
  managerReviewVerdict: string | null;
  managerReviewNotes: string | null;
  managerReviewedBy: { name: string } | null;
  sentAt: string | null;
  sentBy: { name: string } | null;
  pdfBlobUrl: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  redlineRequestedAt: string | null;
  redlineResolvedAt: string | null;
  aiDraftedAt: string | null;
  aiScopeQcJson: ScopeQc | null;
  template: { name: string } | null;
  updatedAt: string;
};

type ScopeQc = {
  verdict: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  mismatches?: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; detail: string }>;
  rationale: string;
};

const STATUS_TONE: Record<string, "neutral" | "brand" | "warn" | "success" | "danger" | "muted"> = {
  DRAFT: "neutral",
  VCIO_REVIEW: "brand",
  MANAGER_REVIEW: "brand",
  APPROVED: "success",
  SENT: "warn",
  ACCEPTED: "success",
  DECLINED: "danger",
  SUPERSEDED: "muted",
};

/**
 * v3.3 — Proposal/SOW panel. The salesperson's home for Step 6 of the SOP.
 */
export function ProposalPanel({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [templates, setTemplates] = useState<SowTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/proposals`);
    if (!res.ok) return;
    const data = await res.json();
    setProposals(data.proposals);
  }, [leadId]);

  useEffect(() => {
    void refresh();
    void fetch("/api/sow-templates").then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
  }, [refresh]);

  async function createProposal(templateId: string | undefined, aiAssist: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          aiAssist,
          ...(templateId ? {} : {
            seed: {
              scopeMarkdown: "## Scope\n\n",
              deliverablesMarkdown: "## Deliverables\n\n",
              timelineMarkdown: "## Timeline\n\n",
              exclusionsMarkdown: "## Exclusions\n\n",
              termsMarkdown: "## Terms\n\n",
            },
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed to create proposal");
        return;
      }
      toast.success(aiAssist && data.aiAssisted ? "AI draft ready — review + edit before sending" : "Draft created");
      setPicker(false);
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (proposals === null) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading proposals…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink-strong tabular">{proposals.length}</span>{" "}
          {proposals.length === 1 ? "version" : "versions"}
          {proposals.some((p) => p.status === "ACCEPTED") && <> · <span className="text-gtn-green font-semibold">accepted</span></>}
          {proposals.some((p) => p.status === "SENT") && <> · awaiting customer</>}
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setPicker((p) => !p)}>
            {picker ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
            {picker ? "Cancel" : "New proposal"}
          </Button>
        )}
      </div>

      {/* Template picker */}
      {picker && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-ink-strong">Pick a starting point</h3>
          <p className="text-xs text-ink-muted">
            Choose a template. Click <strong>Draft with AI</strong> to have Claude fill the merge fields
            from this lead&apos;s discovery + approved pricing + brand voice.
          </p>
          {templates.length === 0 ? (
            <div className="rounded-md bg-warn-soft/40 border border-warn/40 p-3 text-xs text-gtn-amber">
              No SOW templates yet — a Sales Manager / Superadmin can add some at{" "}
              <a href="/admin/sow-templates" className="underline font-medium">Admin → SOW templates</a>. You can still draft from scratch below.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-line-subtle hover:bg-surface-3/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong truncate">{t.name}</p>
                    <p className="text-[11px] text-ink-faint">
                      {t.bundle ? t.bundle.replace(/_/g, " ").toLowerCase() : "generalist"}
                      {t.industry ? ` · ${t.industry.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => createProposal(t.id, false)}>
                      Draft empty
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => createProposal(t.id, true)}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Draft with AI
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end pt-2 border-t border-line-subtle">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => createProposal(undefined, false)}>
              Skip template — start from scratch
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {proposals.length === 0 && !picker && (
        <EmptyState
          Icon={FileText}
          title="No proposal yet"
          body="Build the SOW for this lead. Pick a template, let AI fill it from discovery + pricing, then route through vCIO scope review and Sales Manager pricing review before sending to the customer."
          cta={{ label: "New proposal", href: "#" }}
        />
      )}

      {/* Proposal list — newest version first */}
      {proposals.map((p) => (
        <ProposalCard key={p.id} leadId={leadId} proposal={p} canEdit={canEdit} onChange={refresh} />
      ))}
    </div>
  );
}

function ProposalCard({
  leadId,
  proposal,
  canEdit,
  onChange,
}: {
  leadId: string;
  proposal: Proposal;
  canEdit: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState<keyof Pick<Proposal, "scopeMarkdown" | "deliverablesMarkdown" | "timelineMarkdown" | "exclusionsMarkdown" | "termsMarkdown"> | null>(null);
  const [draft, setDraft] = useState<Partial<Proposal>>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(field: string, value: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Save failed");
        return;
      }
      toast.success("Saved");
      setEditing(null);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, method: "POST" = "POST", body?: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposals/${proposal.id}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Action failed");
        return data;
      }
      await onChange();
      router.refresh();
      return data;
    } finally {
      setBusy(false);
    }
  }

  const status = proposal.status;
  const tone = STATUS_TONE[status] ?? "neutral";

  return (
    <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface-3/40 transition-colors text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink-strong">
              Version {proposal.version}
              {proposal.template && <span className="text-ink-muted font-normal"> · {proposal.template.name}</span>}
            </p>
            <Badge tone={tone} shape="pill" size="xs">{status.toLowerCase().replace(/_/g, " ")}</Badge>
            {proposal.aiDraftedAt && (
              <Badge tone="accent" shape="pill" size="xs">
                <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI-drafted
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-ink-faint mt-0.5 tabular">
            updated {formatDistanceToNow(new Date(proposal.updatedAt), { addSuffix: true })}
          </p>
        </div>
        <GateStatusPills proposal={proposal} />
      </button>

      {expanded && (
        <div className="border-t border-line-subtle px-4 py-4 space-y-4 bg-surface-2/30">
          {/* AI scope QC advisory */}
          {proposal.aiScopeQcJson && (
            <ScopeQcAdvisory qc={proposal.aiScopeQcJson} />
          )}

          {/* Five section editors */}
          {(["scopeMarkdown", "deliverablesMarkdown", "timelineMarkdown", "exclusionsMarkdown", "termsMarkdown"] as const).map((field) => (
            <SectionEditor
              key={field}
              label={field.replace("Markdown", "").replace(/^./, (c) => c.toUpperCase())}
              value={draft[field] ?? proposal[field]}
              editing={editing === field}
              canEdit={canEdit && (status === "DRAFT" || status === "VCIO_REVIEW" || status === "MANAGER_REVIEW")}
              busy={busy}
              onStartEdit={() => { setDraft({ [field]: proposal[field] }); setEditing(field); }}
              onChange={(v) => setDraft({ [field]: v })}
              onSave={() => save(field, draft[field] ?? "")}
              onCancel={() => { setEditing(null); setDraft({}); }}
            />
          ))}

          {/* Reviewer notes */}
          {(proposal.vcioReviewNotes || proposal.managerReviewNotes) && (
            <div className="rounded-md bg-surface border border-line-subtle p-3 space-y-2">
              {proposal.vcioReviewNotes && (
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink-strong">vCIO notes ({proposal.vcioReviewVerdict?.toLowerCase()}):</span>{" "}
                  {proposal.vcioReviewNotes}
                </p>
              )}
              {proposal.managerReviewNotes && (
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink-strong">Manager notes ({proposal.managerReviewVerdict?.toLowerCase()}):</span>{" "}
                  {proposal.managerReviewNotes}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-line-subtle">
            <Button
              asChild
              size="sm"
              variant="secondary"
            >
              <a href={`/leads/${leadId}/proposal/${proposal.id}/print`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Preview PDF
              </a>
            </Button>
            {canEdit && status === "DRAFT" && (
              <Button size="sm" disabled={busy} onClick={() => action("/request-vcio-review")}>
                <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                Request vCIO review
              </Button>
            )}
            {canEdit && status === "APPROVED" && (
              <Button size="sm" disabled={busy} onClick={() => {
                if (!confirm("Send this proposal to the client? Creates a SOW record in Signed Docs.")) return;
                action("/send");
              }}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send to client
              </Button>
            )}
            {canEdit && status === "SENT" && !proposal.redlineRequestedAt && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
                const reason = prompt("What contract change is the client requesting? COO will be notified.");
                if (!reason || reason.length < 10) return;
                action("/redline-review", "POST", { reason });
              }}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Request COO redline review
              </Button>
            )}
          </div>

          {/* Redline status */}
          {proposal.redlineRequestedAt && (
            <div className={cn(
              "rounded-md p-3 text-xs",
              proposal.redlineResolvedAt ? "bg-success-soft/40 border border-success/40 text-gtn-green" : "bg-warn-soft/40 border border-warn/40 text-gtn-amber",
            )}>
              {proposal.redlineResolvedAt
                ? `COO resolved the redline review ${formatDistanceToNow(new Date(proposal.redlineResolvedAt), { addSuffix: true })}.`
                : `COO redline review requested ${formatDistanceToNow(new Date(proposal.redlineRequestedAt), { addSuffix: true })} — awaiting decision.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GateStatusPills({ proposal }: { proposal: Proposal }) {
  return (
    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
      <GatePill label="vCIO" verdict={proposal.vcioReviewVerdict} />
      <GatePill label="Mgr" verdict={proposal.managerReviewVerdict} />
      <GatePill label="Sent" verdict={proposal.sentAt ? "APPROVED" : null} />
      <GatePill label="Won" verdict={proposal.acceptedAt ? "APPROVED" : null} />
    </div>
  );
}

function GatePill({ label, verdict }: { label: string; verdict: string | null }) {
  const ok = verdict === "APPROVED";
  const rejected = verdict === "REJECTED" || verdict === "CHANGES_REQUESTED";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wide rounded-full px-2 py-0.5",
      ok ? "bg-success-soft text-gtn-green" : rejected ? "bg-danger-soft text-gtn-red" : "bg-surface-3 text-ink-faint",
    )}>
      {ok && <Check className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

function SectionEditor({
  label, value, editing, canEdit, busy, onStartEdit, onChange, onSave, onCancel,
}: {
  label: string;
  value: string;
  editing: boolean;
  canEdit: boolean;
  busy: boolean;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-md bg-surface border border-line-subtle">
      <div className="px-3 py-2 flex items-center justify-between border-b border-line-subtle">
        <p className="text-xs font-semibold text-ink-strong uppercase tracking-wide">{label}</p>
        {canEdit && !editing && (
          <button onClick={onStartEdit} className="text-xs text-gtn-purple hover:underline">edit</button>
        )}
      </div>
      <div className="px-3 py-2.5">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              rows={Math.min(14, Math.max(4, value.split("\n").length + 2))}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={onSave} disabled={busy}>
                {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap text-xs text-ink-strong leading-relaxed font-mono">
            {value.trim() || <span className="italic text-ink-faint">(empty)</span>}
          </pre>
        )}
      </div>
    </div>
  );
}

function ScopeQcAdvisory({ qc }: { qc: ScopeQc }) {
  const tone =
    qc.verdict === "APPROVED" ? "bg-success-soft/40 border-success/40 text-gtn-green"
    : qc.verdict === "REJECTED" ? "bg-danger-soft/40 border-danger/40 text-gtn-red"
    : "bg-warn-soft/40 border-warn/40 text-gtn-amber";
  return (
    <div className={cn("rounded-md border p-3 space-y-2", tone)}>
      <p className="text-xs font-semibold inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        AI scope-vs-discovery scan · {qc.verdict.toLowerCase().replace(/_/g, " ")}
      </p>
      <p className="text-xs">{qc.rationale}</p>
      {qc.mismatches && qc.mismatches.length > 0 && (
        <ul className="text-xs space-y-1 mt-2 list-disc list-inside">
          {qc.mismatches.map((m, i) => (
            <li key={i}><span className="font-semibold">[{m.severity}]</span> {m.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Re-use the Label/Input imports to keep them used (Tailwind purge defense)
const _unused = { Label, Input };
void _unused;
