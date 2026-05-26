"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ServiceBundle } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  AUTHORITY_LABEL,
  BUDGET_STATUS_LABEL,
  OBJECTION_STATUS_LABEL,
  TEMPERATURE_LABEL,
  type Commitment,
  type DecisionMaker,
  type ObjectionSkeptic,
  type SuccessCriterion,
} from "@/lib/handoff/schema";

type Lead = {
  id: string;
  businessName: string;
  industry: string;
  seatCount: number | null;
  siteCount: number;
  primaryContactName: string | null;
  primaryContactTitle: string | null;
  primaryContactEmail: string | null;
  executiveSponsorName: string | null;
  executiveSponsorTitle: string | null;
  dealQualityScore: number;
  servicesScore: number;
  customerScore: number;
  suggestedBundle: ServiceBundle | null;
  owner: { name: string; email: string };
  complianceDrivers: string[];
};

const CONTRACT_OPTIONS = ["MSA", "SOW", "BAA", "NDA", "DPA", "AMENDMENT"];

export function HandoffForm({ lead }: { lead: Lead }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Deal facts
  const [dealValue, setDealValue] = useState<string>("");
  const [bundleId, setBundleId] = useState<ServiceBundle | "">(lead.suggestedBundle ?? "");
  const [complianceOverlay, setComplianceOverlay] = useState<string[]>(lead.complianceDrivers ?? []);
  const [contractsSigned, setContractsSigned] = useState<string[]>([]);

  // Stakeholder map
  const [decisionMakers, setDecisionMakers] = useState<DecisionMaker[]>(
    lead.executiveSponsorName
      ? [{ name: lead.executiveSponsorName, role: lead.executiveSponsorTitle ?? "", authority: "FINAL", temperature: "SUPPORTIVE" }]
      : [{ name: "", role: "", authority: "FINAL", temperature: "NEUTRAL" }],
  );
  const [stakeholderContext, setStakeholderContext] = useState("");

  // Commitments
  const [hardCommitments, setHardCommitments] = useState<Commitment[]>([{ text: "", sowRef: "" }]);
  const [softCommitments, setSoftCommitments] = useState<Commitment[]>([{ text: "" }]);

  // Objections + skeptics
  const [objectionsAndSkeptics, setObjections] = useState<ObjectionSkeptic[]>([
    { name: "", concern: "", status: "WATCH" },
  ]);

  // Budget snapshot
  const [budgetStatus, setBudgetStatus] = useState<"APPROVED" | "BEING_PLANNED" | "INFORMAL" | "UNKNOWN">("UNKNOWN");
  const [budgetRange, setBudgetRange] = useState("");
  const [budgetNotes, setBudgetNotes] = useState("");

  // Success criteria
  const [successCriteria, setSuccessCriteria] = useState<SuccessCriterion[]>([{ metric: "", target: "", owner: "" }]);

  // v3.3 — SOP Step 8 — stated pain + Day-30 quick win
  const [statedPain, setStatedPain] = useState("");
  const [day30QuickWin, setDay30QuickWin] = useState("");
  const [aiBusy, setAiBusy] = useState<"pain" | "quickwin" | null>(null);

  const [notes, setNotes] = useState("");

  async function aiSuggestPain() {
    setAiBusy("pain");
    try {
      const res = await fetch(`/api/leads/${lead.id}/handoff/ai-pain-recap`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatedPain(data.value.statedPain);
        toast.success("Pain recap drafted — review and edit");
      } else {
        toast.error(data.detail ?? "AI unavailable");
      }
    } finally { setAiBusy(null); }
  }

  async function aiSuggestQuickWin() {
    setAiBusy("quickwin");
    try {
      const res = await fetch(`/api/leads/${lead.id}/handoff/ai-quick-win`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setDay30QuickWin(data.value.quickWin);
        toast.success("Quick win suggested — review and edit");
      } else {
        toast.error(data.detail ?? "AI unavailable");
      }
    } finally { setAiBusy(null); }
  }

  function toggleArray(setter: (v: string[]) => void, list: string[], value: string) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }
  function setItem<T>(list: T[], idx: number, patch: Partial<T>): T[] {
    return list.map((c, i) => (i === idx ? { ...c, ...patch } : c));
  }

  async function submit() {
    // Light client validation
    const cleanDms = decisionMakers.filter((d) => d.name.trim());
    if (cleanDms.length === 0) {
      toast.error("At least one decision-maker required.");
      return;
    }
    const cleanHard = hardCommitments.filter((c) => c.text.trim());
    const cleanSoft = softCommitments.filter((c) => c.text.trim());
    const cleanObj = objectionsAndSkeptics.filter((o) => o.concern.trim());
    const cleanSuccess = successCriteria.filter((s) => s.metric.trim());

    setSubmitting(true);
    try {
      const res = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          dealValue: dealValue ? Number(dealValue) : undefined,
          bundleId: bundleId || undefined,
          complianceOverlay,
          contractsSigned,
          decisionMakers: cleanDms,
          stakeholderContext: stakeholderContext.trim() || undefined,
          hardCommitments: cleanHard,
          softCommitments: cleanSoft,
          objectionsAndSkeptics: cleanObj,
          budgetSnapshot: budgetStatus !== "UNKNOWN" || budgetRange || budgetNotes
            ? { status: budgetStatus, range: budgetRange || undefined, notes: budgetNotes || undefined }
            : undefined,
          successCriteria: cleanSuccess,
          statedPain: statedPain.trim() || undefined,
          day30QuickWin: day30QuickWin.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Failed");
      } else {
        toast.success("Handoff initiated. COO can now accept.");
        router.push(`/leads/${lead.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function printPage() { window.print(); }

  return (
    <div className="space-y-4">
      {/* Deal facts */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Deal facts</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Deal value (MRR + onboarding total)</Label>
            <Input type="number" min={0} value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="e.g. 24500" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bundle</Label>
            <select
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value as ServiceBundle | "")}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="">— None / custom —</option>
              {(Object.values(ServiceBundle) as ServiceBundle[]).map((b) => (
                <option key={b} value={b}>{b.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-xs">Compliance overlay (active drivers)</Label>
          <div className="flex flex-wrap gap-1.5">
            {["HIPAA", "PCI", "CMMC", "SOC2", "GDPR", "ISO27001", "FERPA", "GLBA", "NIST_800_171"].map((c) => {
              const on = complianceOverlay.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleArray(setComplianceOverlay, complianceOverlay, c)}
                  className={`text-[11px] rounded px-2 py-0.5 border ${
                    on ? "bg-gtn-purple text-white border-gtn-purple"
                       : "bg-white text-gtn-grey-2 border-gtn-lavender-2 hover:border-gtn-purple"
                  }`}
                >{c}</button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-xs">Contracts signed</Label>
          <div className="flex flex-wrap gap-1.5">
            {CONTRACT_OPTIONS.map((c) => {
              const on = contractsSigned.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleArray(setContractsSigned, contractsSigned, c)}
                  className={`text-[11px] rounded px-2 py-0.5 border ${
                    on ? "bg-gtn-green-bg text-gtn-green border-gtn-green"
                       : "bg-white text-gtn-grey-2 border-gtn-lavender-2 hover:border-gtn-green"
                  }`}
                >{c}</button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Decision makers */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Decision makers (up to 5)</h2>
        <div className="space-y-3">
          {decisionMakers.map((d, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input className="sm:col-span-3" placeholder="Name *" value={d.name} onChange={(e) => setDecisionMakers((s) => setItem(s, idx, { name: e.target.value }))} />
              <Input className="sm:col-span-3" placeholder="Role / title" value={d.role ?? ""} onChange={(e) => setDecisionMakers((s) => setItem(s, idx, { role: e.target.value }))} />
              <select
                className="sm:col-span-3 flex h-10 rounded-md border border-input bg-white px-2 text-xs"
                value={d.authority ?? ""}
                onChange={(e) => setDecisionMakers((s) => setItem(s, idx, { authority: (e.target.value || undefined) as DecisionMaker["authority"] }))}
              >
                <option value="">— authority —</option>
                {(Object.keys(AUTHORITY_LABEL) as Array<keyof typeof AUTHORITY_LABEL>).map((k) => (
                  <option key={k} value={k}>{AUTHORITY_LABEL[k]}</option>
                ))}
              </select>
              <select
                className="sm:col-span-3 flex h-10 rounded-md border border-input bg-white px-2 text-xs"
                value={d.temperature ?? ""}
                onChange={(e) => setDecisionMakers((s) => setItem(s, idx, { temperature: (e.target.value || undefined) as DecisionMaker["temperature"] }))}
              >
                <option value="">— temperature —</option>
                {(Object.keys(TEMPERATURE_LABEL) as Array<keyof typeof TEMPERATURE_LABEL>).map((k) => (
                  <option key={k} value={k}>{TEMPERATURE_LABEL[k]}</option>
                ))}
              </select>
              <Input
                className="sm:col-span-12"
                placeholder="Preferred comms / cadence notes"
                value={d.comms ?? ""}
                onChange={(e) => setDecisionMakers((s) => setItem(s, idx, { comms: e.target.value }))}
              />
            </div>
          ))}
          {decisionMakers.length < 5 && (
            <Button variant="ghost" size="sm" onClick={() => setDecisionMakers((s) => [...s, { name: "", role: "" }])}>+ Add decision maker</Button>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-xs">Stakeholder context / political read</Label>
          <Textarea rows={3} value={stakeholderContext} onChange={(e) => setStakeholderContext(e.target.value)} />
        </div>
      </Card>

      {/* Hard commitments */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Hard commitments (in SOW)</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">Concrete deliverables with SOW reference and deadline.</p>
        <div className="space-y-2">
          {hardCommitments.map((c, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input className="sm:col-span-7" placeholder="Commitment" value={c.text} onChange={(e) => setHardCommitments((s) => setItem(s, idx, { text: e.target.value }))} />
              <Input className="sm:col-span-2" placeholder="SOW ref" value={c.sowRef ?? ""} onChange={(e) => setHardCommitments((s) => setItem(s, idx, { sowRef: e.target.value }))} />
              <Input className="sm:col-span-3" placeholder="Deadline" value={c.deadline ?? ""} onChange={(e) => setHardCommitments((s) => setItem(s, idx, { deadline: e.target.value }))} />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setHardCommitments((s) => [...s, { text: "" }])}>+ Add hard commitment</Button>
        </div>
      </Card>

      {/* Soft commitments */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Soft commitments</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">Implied or verbal — &quot;we&apos;ll try to&quot; / &quot;we expect&quot; items.</p>
        <div className="space-y-2">
          {softCommitments.map((c, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input className="sm:col-span-9" placeholder="Commitment" value={c.text} onChange={(e) => setSoftCommitments((s) => setItem(s, idx, { text: e.target.value }))} />
              <Input className="sm:col-span-3" placeholder="Deadline" value={c.deadline ?? ""} onChange={(e) => setSoftCommitments((s) => setItem(s, idx, { deadline: e.target.value }))} />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSoftCommitments((s) => [...s, { text: "" }])}>+ Add soft commitment</Button>
        </div>
      </Card>

      {/* Objections + skeptics */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Objections + skeptics</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">{"Who's not on board? Status helps Ops know what to watch for in week 1."}</p>
        <div className="space-y-2">
          {objectionsAndSkeptics.map((o, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input className="sm:col-span-3" placeholder="Name (optional)" value={o.name ?? ""} onChange={(e) => setObjections((s) => setItem(s, idx, { name: e.target.value }))} />
              <Input className="sm:col-span-6" placeholder="Concern" value={o.concern} onChange={(e) => setObjections((s) => setItem(s, idx, { concern: e.target.value }))} />
              <select
                className="sm:col-span-3 flex h-10 rounded-md border border-input bg-white px-2 text-xs"
                value={o.status ?? ""}
                onChange={(e) => setObjections((s) => setItem(s, idx, { status: (e.target.value || undefined) as ObjectionSkeptic["status"] }))}
              >
                <option value="">— status —</option>
                {(Object.keys(OBJECTION_STATUS_LABEL) as Array<keyof typeof OBJECTION_STATUS_LABEL>).map((k) => (
                  <option key={k} value={k}>{OBJECTION_STATUS_LABEL[k]}</option>
                ))}
              </select>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setObjections((s) => [...s, { concern: "", status: "WATCH" }])}>+ Add objection / skeptic</Button>
        </div>
      </Card>

      {/* Budget snapshot */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Budget snapshot</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              value={budgetStatus}
              onChange={(e) => setBudgetStatus(e.target.value as typeof budgetStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
            >
              {(Object.keys(BUDGET_STATUS_LABEL) as Array<keyof typeof BUDGET_STATUS_LABEL>).map((k) => (
                <option key={k} value={k}>{BUDGET_STATUS_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Range</Label>
            <Input value={budgetRange} onChange={(e) => setBudgetRange(e.target.value)} placeholder="e.g. $8-12k MRR" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-xs">Notes</Label>
          <Textarea rows={2} value={budgetNotes} onChange={(e) => setBudgetNotes(e.target.value)} />
        </div>
      </Card>

      {/* Success criteria */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Success criteria</h2>
        <p className="text-xs text-gtn-grey-2 mb-2">{"How will Ops know they're succeeding at the 90-day mark?"}</p>
        <div className="space-y-2">
          {successCriteria.map((c, idx) => (
            <div key={idx} className="grid sm:grid-cols-12 gap-2">
              <Input className="sm:col-span-6" placeholder="Metric" value={c.metric} onChange={(e) => setSuccessCriteria((s) => setItem(s, idx, { metric: e.target.value }))} />
              <Input className="sm:col-span-3" placeholder="Target" value={c.target ?? ""} onChange={(e) => setSuccessCriteria((s) => setItem(s, idx, { target: e.target.value }))} />
              <Input className="sm:col-span-3" placeholder="Owner" value={c.owner ?? ""} onChange={(e) => setSuccessCriteria((s) => setItem(s, idx, { owner: e.target.value }))} />
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setSuccessCriteria((s) => [...s, { metric: "" }])}>+ Add success criterion</Button>
        </div>
      </Card>

      {/* v3.3 — SOP Step 8: stated pain + Day-30 quick win */}
      <Card>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gtn-navy">Stated pain (in the customer&apos;s words)</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={aiSuggestPain}
            disabled={aiBusy !== null}
          >
            {aiBusy === "pain" ? "Pulling…" : "✨ Pull from discovery"}
          </Button>
        </div>
        <Textarea
          rows={3}
          value={statedPain}
          onChange={(e) => setStatedPain(e.target.value)}
          placeholder="1-2 sentences paraphrasing the strongest pain signal. The COO + vCIO read this first."
        />
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gtn-navy">Day-30 quick win we promised</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={aiSuggestQuickWin}
            disabled={aiBusy !== null}
          >
            {aiBusy === "quickwin" ? "Thinking…" : "✨ Suggest a quick win"}
          </Button>
        </div>
        <Textarea
          rows={2}
          value={day30QuickWin}
          onChange={(e) => setDay30QuickWin(e.target.value)}
          placeholder='e.g. "Deploy MFA on all 47 O365 accounts by Day 14, summarize results at the Day-30 check-in."'
        />
        <p className="text-[11px] text-gtn-grey-3 mt-2">
          Becomes an OnboardingTask on the new Customer with due date = handoff acceptance + 30 days.
        </p>
      </Card>

      {/* Notes */}
      <Card>
        <h2 className="text-sm font-semibold text-gtn-navy mb-3">Free-form notes to Ops</h2>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={printPage}>Print</Button>
        <Button onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Initiate handoff"}</Button>
      </div>
    </div>
  );
}
