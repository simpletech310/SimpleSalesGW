"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Input";

type Verdict = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";

type ScopeQc = {
  verdict: Verdict;
  rationale: string;
  mismatches?: Array<{ severity: "HIGH" | "MEDIUM" | "LOW"; detail: string }>;
};

export function ReviewForm({
  leadId,
  proposalId,
  tier,
}: {
  leadId: string;
  proposalId: string;
  tier: "VCIO" | "MANAGER";
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict>("APPROVED");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [qc, setQc] = useState<ScopeQc | null>(null);
  const [qcBusy, setQcBusy] = useState(false);

  // For vCIO: auto-run scope-QC on mount
  useEffect(() => {
    if (tier !== "VCIO") return;
    setQcBusy(true);
    fetch(`/api/leads/${leadId}/proposals/${proposalId}/ai-scope-qc`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setQc(data.value as ScopeQc);
      })
      .finally(() => setQcBusy(false));
  }, [tier, leadId, proposalId]);

  async function submit() {
    if (verdict !== "APPROVED" && notes.trim().length < 5) {
      toast.error("Add a note explaining the verdict.");
      return;
    }
    setBusy(true);
    try {
      const path = tier === "VCIO" ? "vcio-review" : "manager-review";
      const res = await fetch(`/api/leads/${leadId}/proposals/${proposalId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verdict, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Submit failed");
        return;
      }
      toast.success(
        verdict === "APPROVED"
          ? tier === "VCIO" ? "Approved — advances to Sales Manager pricing review" : "Approved — ready to send to client"
          : "Sent back to draft — salesperson will see your notes",
      );
      router.push("/sales/proposals");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5 space-y-4">
      <header>
        <h2 className="text-sm font-semibold text-ink-strong">Your decision</h2>
        <p className="text-xs text-ink-muted mt-0.5">
          {tier === "VCIO"
            ? "Validate scope + deliverables match what discovery + the customer's reality look like. Reject only if the deal is fundamentally misscoped."
            : "Validate pricing + terms match policy. Reject only if the price needs to change before sending."}
        </p>
      </header>

      {tier === "VCIO" && (
        qcBusy ? (
          <div className="rounded-md bg-brand-soft/40 border border-brand/40 p-3 text-xs text-gtn-navy inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running AI scope-vs-discovery scan…
          </div>
        ) : qc ? (
          <div className={`rounded-md border p-3 space-y-2 ${
            qc.verdict === "APPROVED" ? "bg-success-soft/40 border-success/40 text-gtn-green"
            : qc.verdict === "REJECTED" ? "bg-danger-soft/40 border-danger/40 text-gtn-red"
            : "bg-warn-soft/40 border-warn/40 text-gtn-amber"
          }`}>
            <p className="text-xs font-semibold inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI scan suggests: {qc.verdict.toLowerCase().replace(/_/g, " ")}
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
        ) : null
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["APPROVED", "CHANGES_REQUESTED", "REJECTED"] as Verdict[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            className={`px-3 py-3 rounded-md border text-sm font-medium transition-colors ${
              verdict === v
                ? v === "APPROVED" ? "bg-success-soft text-gtn-green border-success/50"
                : v === "REJECTED" ? "bg-danger-soft text-gtn-red border-danger/50"
                : "bg-warn-soft text-gtn-amber border-warn/50"
                : "border-line-subtle hover:border-line-strong text-ink-muted"
            }`}
          >
            {v === "APPROVED" && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
            {v === "REJECTED" && <X className="h-3.5 w-3.5 inline mr-1.5" />}
            {v === "APPROVED" ? "Approve" : v === "CHANGES_REQUESTED" ? "Request changes" : "Reject"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-notes">
          Notes {verdict !== "APPROVED" && <span className="text-danger">*</span>}
        </Label>
        <Textarea
          id="review-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            verdict === "APPROVED"
              ? "Optional: anything the salesperson should know before sending."
              : "Required: what needs to change. The salesperson sees this verbatim."
          }
        />
      </div>

      <div className="flex justify-end pt-2 border-t border-line-subtle">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          Submit {tier === "VCIO" ? "vCIO" : "Manager"} verdict
        </Button>
      </div>
    </section>
  );
}
