"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Sparkles, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NextStepHint } from "@/components/help/NextStepHint";
import type { Role } from "@prisma/client";

type QcSeverity = "blocking" | "warn" | "ok";
type QcIssue = { field: string; concern: string; severity: "blocking" | "warn" };
type QcResult = {
  severity: QcSeverity;
  issues: QcIssue[];
  suggestions: string[];
  summary: string;
  generatedAt: string;
};

type HandoffRow = {
  id: string;
  status: "DRAFT" | "INITIATED" | "ACCEPTED" | "REJECTED";
  notes: string | null;
  rejectedReason: string | null;
  initiatedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  dealValue: string | null;
  bundleId: string | null;
  complianceOverlay: string[];
  contractsSigned: string[];
  decisionMakers: unknown;
  hardCommitments: unknown;
  successCriteria: unknown;
  qcResult: QcResult | null;
  initiator: { name: string };
  acceptor: { name: string } | null;
};

export function HandoffCard({
  leadId,
  role,
  hasCustomer = true,
}: {
  leadId: string;
  role: Role;
  /** v2.15.2 — server passes whether the lead already has a Customer.
   *  Used to detect "orphaned accepted handoff" and surface the recovery CTA. */
  hasCustomer?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<HandoffRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [qcRunning, setQcRunning] = useState<string | null>(null);

  const canAccept = role === "COO" || role === "SUPERADMIN";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/handoffs`);
    const data = await res.json();
    if (res.ok) setItems(data.handoffs);
  }, [leadId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // v2.15.2 — recover an orphaned accepted handoff. Calls
  // POST /api/handoffs/[id]/create-customer; idempotent server-side.
  async function recoverCustomer(handoffId: string) {
    setRecovering(true);
    try {
      const res = await fetch(`/api/handoffs/${handoffId}/create-customer`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Could not create the account");
        return;
      }
      if (data.alreadyExisted) {
        toast.message("Account already existed — refreshing.");
      } else {
        toast.success("Account created — vCIO will see it under /accounts now.");
      }
      await refresh();
      router.refresh();
    } finally {
      setRecovering(false);
    }
  }

  async function runQc(id: string) {
    setQcRunning(id);
    try {
      const res = await fetch(`/api/handoffs/${id}/qc`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "QC failed");
        return;
      }
      toast.success(`QC: ${data.severity}`);
      await refresh();
    } catch {
      toast.error("QC failed");
    } finally {
      setQcRunning(null);
    }
  }

  async function decide(id: string, action: "accept" | "reject") {
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = prompt("Why is this handoff being rejected? (required)");
      if (!reason) return;
      body = { reason };
    } else {
      const note = prompt("Optional acceptance note (or leave blank):") ?? undefined;
      if (note && note.trim()) body = { note: note.trim() };
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/handoffs/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
        return;
      }
      toast.success(action === "accept" ? "Handoff accepted" : "Handoff rejected");
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (items === null || items.length === 0) return null;

  const hasInitiated = items.some((h) => h.status === "INITIATED");
  const hasAccepted = items.some((h) => h.status === "ACCEPTED");

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gtn-navy mb-3">Sales → Ops handoff</h3>

      {hasInitiated && !canAccept && (
        <div className="mb-3">
          <NextStepHint label="Waiting on">
            COO acceptance. You&apos;ll see this lead spawn an Account under /accounts once Marcelo accepts.
          </NextStepHint>
        </div>
      )}
      {hasAccepted && hasCustomer && (
        <div className="mb-3">
          <NextStepHint
            label="What's next"
            action={{ label: "Open the Account", href: `/accounts` }}
          >
            Handoff accepted. The customer is now under /accounts; vCIO takes over Discovery + onboarding.
          </NextStepHint>
        </div>
      )}

      {/* v2.15.2 — orphaned-accepted-handoff recovery. The handoff says
          ACCEPTED but no Customer row exists for this lead (likely a partial
          failure during the accept transaction, or accepted before v2.0-B
          shipped). Surface a one-click fix instead of leaving the deal stuck. */}
      {hasAccepted && !hasCustomer && (
        <div className="mb-3 rounded-md border border-gtn-amber/40 bg-[#FEF3E2] p-3">
          <p className="text-sm font-semibold text-gtn-navy mb-1">
            Handoff accepted, but no Account exists yet.
          </p>
          <p className="text-xs text-gtn-grey-2 mb-2">
            The acceptance went through but the Customer record didn&apos;t get created
            (likely a one-time hiccup). Click below to create it now — vCIO will see
            the new client under <strong>/accounts</strong> as soon as you do.
          </p>
          {canAccept ? (
            <Button
              size="sm"
              disabled={recovering}
              onClick={() => {
                const acceptedHandoff = items.find((h) => h.status === "ACCEPTED");
                if (acceptedHandoff) recoverCustomer(acceptedHandoff.id);
              }}
            >
              {recovering ? "Creating…" : "Create account now"}
            </Button>
          ) : (
            <p className="text-xs text-gtn-grey-2 italic">
              Ask Marcelo (COO) or your Superadmin to click &quot;Create account now.&quot;
            </p>
          )}
        </div>
      )}

      <ul className="divide-y divide-gtn-lavender-2">
        {items.map((h) => (
          <li key={h.id} className="py-3 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <StatusPill status={h.status} />
                <p className="text-sm font-medium text-gtn-navy mt-1">
                  Initiated by {h.initiator.name}
                </p>
                <p className="text-xs text-gtn-grey-3">
                  {format(new Date(h.initiatedAt ?? h.createdAt), "PPp")}
                </p>
              </div>
              {h.status === "INITIATED" && canAccept && (
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => decide(h.id, "accept")}>
                    Accept handoff
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => decide(h.id, "reject")}>
                    Reject
                  </Button>
                </div>
              )}
            </div>

            {/* Structured highlights */}
            <div className="text-xs text-gtn-grey-2 space-y-0.5">
              {h.dealValue && (
                <p>Deal value: <span className="font-mono text-gtn-navy">${Number(h.dealValue).toLocaleString()}</span>
                  {h.bundleId && <> · Bundle: <strong className="text-gtn-navy">{h.bundleId.replace(/_/g, " ")}</strong></>}
                </p>
              )}
              {(Array.isArray(h.decisionMakers) ? h.decisionMakers.length : 0) > 0 && (
                <p>
                  {(h.decisionMakers as unknown[]).length} decision maker{(h.decisionMakers as unknown[]).length === 1 ? "" : "s"} ·
                  {" "}{(Array.isArray(h.hardCommitments) ? h.hardCommitments.length : 0)} hard commit{(h.hardCommitments as unknown[])?.length === 1 ? "" : "s"} ·
                  {" "}{(Array.isArray(h.successCriteria) ? h.successCriteria.length : 0)} success criteria
                </p>
              )}
              {h.complianceOverlay.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {h.complianceOverlay.map((c) => (
                    <span key={c} className="text-[10px] bg-gtn-lavender text-gtn-purple rounded px-1.5 py-0.5">{c}</span>
                  ))}
                </div>
              )}
              {h.contractsSigned.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {h.contractsSigned.map((c) => (
                    <span key={c} className="text-[10px] bg-gtn-green-bg text-gtn-green rounded px-1.5 py-0.5">✓ {c}</span>
                  ))}
                </div>
              )}
            </div>

            {h.notes && (
              <pre className="text-xs bg-gtn-lavender p-2 rounded whitespace-pre-wrap font-mono">{h.notes}</pre>
            )}

            {/* v2.20 — AI quality check */}
            {(h.status === "INITIATED" || h.status === "DRAFT") && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-gtn-grey-2">
                  AI quality check {h.qcResult ? "rerun" : "looks at decision-makers, commitments, contracts, and success criteria"}.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runQc(h.id)}
                  disabled={qcRunning === h.id}
                  className="h-7 px-2 text-xs"
                >
                  {qcRunning === h.id ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Checking…</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5 mr-1" /> {h.qcResult ? "Re-run QC" : "Run AI quality check"}</>
                  )}
                </Button>
              </div>
            )}

            {h.qcResult && <QcReport qc={h.qcResult} />}

            {h.status === "ACCEPTED" && h.acceptor && (
              <p className="text-xs text-gtn-green">
                ✓ Accepted by {h.acceptor.name} · {h.acceptedAt ? format(new Date(h.acceptedAt), "PPp") : ""}
              </p>
            )}
            {h.status === "REJECTED" && (
              <div className="text-xs text-gtn-red">
                <p>
                  Rejected{h.acceptor ? ` by ${h.acceptor.name}` : ""} ·{" "}
                  {h.rejectedAt ? format(new Date(h.rejectedAt), "PPp") : ""}
                </p>
                {h.rejectedReason && <p className="mt-1"><strong>Reason:</strong> {h.rejectedReason}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function QcReport({ qc }: { qc: QcResult }) {
  const sev = qc.severity;
  const bg =
    sev === "blocking" ? "border-gtn-red/40 bg-[#FBE9E7]"
      : sev === "warn" ? "border-gtn-amber/40 bg-[#FEF3E2]"
      : "border-gtn-green/40 bg-gtn-green-bg";
  const Icon = sev === "blocking" ? ShieldAlert : sev === "warn" ? AlertTriangle : CheckCircle2;
  const labelColor =
    sev === "blocking" ? "text-gtn-red"
      : sev === "warn" ? "text-gtn-amber"
      : "text-gtn-green";
  return (
    <div className={`rounded-md border p-3 space-y-2 ${bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${labelColor}`} />
        <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>
          AI QC: {sev}
        </p>
      </div>
      {qc.summary && <p className="text-sm text-gtn-navy">{qc.summary}</p>}
      {qc.issues.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-grey-2">Issues</p>
          <ul className="space-y-1 mt-1">
            {qc.issues.map((iss, i) => (
              <li key={i} className="text-sm text-gtn-navy">
                <span className={`text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 mr-2 ${iss.severity === "blocking" ? "bg-gtn-red/20 text-gtn-red" : "bg-gtn-amber/20 text-gtn-amber"}`}>
                  {iss.severity}
                </span>
                <strong>{iss.field}:</strong> {iss.concern}
              </li>
            ))}
          </ul>
        </div>
      )}
      {qc.suggestions.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-gtn-grey-2">Suggested fixes</p>
          <ul className="list-disc list-inside text-sm text-gtn-navy mt-1">
            {qc.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-gtn-grey-3">
        Generated {format(new Date(qc.generatedAt), "PPp")}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: HandoffRow["status"] }) {
  const cls =
    status === "ACCEPTED" ? "bg-gtn-green-bg text-gtn-green"
      : status === "REJECTED" ? "bg-[#FBE9E7] text-gtn-red"
      : status === "INITIATED" ? "bg-[#FEF3E2] text-gtn-amber"
      : "bg-gtn-lavender text-gtn-grey-2";
  const label = status === "INITIATED" ? "Awaiting Ops" : status;
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{label}</span>;
}
