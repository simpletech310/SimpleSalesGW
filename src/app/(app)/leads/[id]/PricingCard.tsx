"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ServiceBundle, type Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FieldHelp } from "@/components/help/FieldHelp";
import { GlossaryTerm } from "@/components/help/GlossaryTerm";
import { HELP } from "@/lib/help-copy";
import { discountPercent, approvalTier } from "@/lib/pricing";
import {
  bundleIncludesNormalized,
  computeSticker,
  fmtUsd,
  isBelowFloor,
  type PricingCatalog,
} from "@/lib/pricing/catalog";

type ApprovalRow = {
  id: string;
  bundleId: string | null;
  seatCount: number | null;
  stickerPrice: string;        // MRR sticker
  proposedPrice: string;       // MRR proposed
  stickerOneTime: string | null;
  proposedOneTime: string | null;
  discountPct: string;
  belowFloor: boolean;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  requester: { name: string };
  approver: { name: string } | null;
};

type Props = {
  leadId: string;
  role: Role;
  suggestedBundle: ServiceBundle | null;
  seatCount: number | null;
};

export function PricingCard({ leadId, role, suggestedBundle, seatCount }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ApprovalRow[] | null>(null);
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);
  const [canSeeFloor, setCanSeeFloor] = useState(false);
  const [open, setOpen] = useState(false);

  // Form state
  const initialBundle: ServiceBundle = suggestedBundle ?? ServiceBundle.PROFESSIONAL;
  const initialSeats = seatCount && seatCount > 0 ? seatCount : 75;
  const [bundleId, setBundleId] = useState<ServiceBundle>(initialBundle);
  const [seats, setSeats] = useState<number>(initialSeats);
  const [multiYear, setMultiYear] = useState(false);
  const [proposedMrr, setProposedMrr] = useState<string>("");
  const [proposedOneTime, setProposedOneTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/leads/${leadId}/pricing-approvals`);
    const data = await res.json();
    if (res.ok) setItems(data.approvals);
  }, [leadId]);

  const loadCatalog = useCallback(async () => {
    const res = await fetch("/api/pricing/catalog");
    const data = await res.json();
    if (res.ok) {
      setCatalog(data.catalog);
      setCanSeeFloor(data.canSeeFloor);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  // Derive sticker computation when catalog + bundle + seats are present.
  const sticker = useMemo(() => {
    if (!catalog) return null;
    return computeSticker(catalog, bundleId, seats);
  }, [catalog, bundleId, seats]);

  // Default proposed values from sticker when sticker first arrives or bundle changes.
  useEffect(() => {
    if (sticker && proposedMrr === "") {
      setProposedMrr(String(sticker.monthlyMrr));
    }
    if (sticker && proposedOneTime === "") {
      setProposedOneTime(String(sticker.onboardingTotal));
    }
    // We only want to seed once per bundle/seats change — clear when bundle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleId, seats, sticker]);

  // Live calculations on form
  const proposedMrrN = Number(proposedMrr) || 0;
  const proposedOneTimeN = Number(proposedOneTime) || 0;
  const pct = sticker ? discountPercent(sticker.monthlyMrr, proposedMrrN) : 0;
  const below = sticker ? isBelowFloor(sticker, proposedMrrN) : false;
  // v2.2 4-bucket preview that mirrors decideAuthority server-side.
  const previewTier: "NONE" | "SELF" | "MANAGER" | "COO" =
    below ? "COO"
      : multiYear && pct > 0 ? "COO"
      : pct <= 0 ? "NONE"
      : pct <= 5 ? "SELF"
      : pct <= 20 ? "MANAGER"
      : "COO";
  const isCustom = bundleId === ServiceBundle.CUSTOM;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sticker) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/pricing-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId,
          seatCount: seats,
          stickerMrr: sticker.monthlyMrr,
          proposedMrr: proposedMrrN,
          stickerOneTime: sticker.onboardingTotal || undefined,
          proposedOneTime: proposedOneTimeN || undefined,
          multiYear,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data?.error ?? "Failed");
      else {
        if (data.autoApproved) {
          toast.success("Self-approved per Playbook — proposal ready");
        } else {
          toast.success(`Sent to ${data.tier === "MANAGER" ? "Sales Manager" : "COO"}${data.belowFloor ? " (below-floor)" : ""}`);
        }
        setOpen(false);
        setProposedMrr(""); setProposedOneTime(""); setReason(""); setMultiYear(false);
        await refresh();
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    let note: string | undefined;
    if (action === "reject") {
      const v = prompt("Reason for rejection?");
      if (!v) return;
      note = v;
    } else {
      const v = prompt("Optional approval note (or leave blank):") ?? undefined;
      note = v && v.trim() ? v.trim() : undefined;
    }
    const res = await fetch(`/api/pricing-approvals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data?.error ?? "Failed"); return; }
    toast.success(action === "approve" ? "Approved" : "Rejected");
    await refresh();
    router.refresh();
  }

  const canApproveManager = role === "SALES_MANAGER" || role === "SUPERADMIN";
  const canApproveCoo = role === "COO" || role === "SUPERADMIN";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gtn-navy">Pricing</h3>
          {suggestedBundle && (
            <p className="text-xs text-gtn-grey-2 mt-0.5">
              Scoring engine suggests <strong>{suggestedBundle.replace(/_/g, " ")}</strong>
              {seatCount ? ` for ${seatCount} seats` : ""}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Cancel" : "Request approval"}
        </Button>
      </div>

      {open && catalog && (
        <form onSubmit={submit} className="space-y-4 border-b border-gtn-lavender-2 pb-4 mb-4">
          {/* Bundle + seats */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Bundle</Label>
                <FieldHelp>{HELP.pricing.bundle}</FieldHelp>
              </div>
              <select
                value={bundleId}
                onChange={(e) => {
                  setBundleId(e.target.value as ServiceBundle);
                  setProposedMrr(""); // re-seed on next sticker compute
                  setProposedOneTime("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                {(Object.values(ServiceBundle) as ServiceBundle[]).map((b) => (
                  <option key={b} value={b}>
                    {catalog.bundles[b].label}{b === suggestedBundle ? " ★ suggested" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label className="text-xs">Seats</Label>
                <FieldHelp>{HELP.pricing.seats}</FieldHelp>
              </div>
              <Input
                type="number"
                min={1}
                value={seats}
                onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
              />
            </div>
          </div>

          {/* Sticker breakdown */}
          {sticker && !isCustom && (
            <div className="rounded-md bg-gtn-lavender p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-gtn-grey-2 mb-2">
                {catalog.bundles[bundleId].label} sticker
              </p>
              {sticker.tier ? (
                <p className="text-gtn-navy">
                  <span className="font-mono">{seats}</span> seats × <span className="font-mono">{fmtUsd(sticker.perSeatMrr)}</span>/seat/mo
                  = <strong className="font-mono">{fmtUsd(sticker.monthlyMrr)}/mo MRR</strong>
                  {canSeeFloor && (
                    <span className="text-gtn-grey-3"> · floor {fmtUsd(sticker.monthlyFloor)}/mo</span>
                  )}
                </p>
              ) : (
                <p className="text-gtn-amber text-xs">Out-of-band seat count — no published per-seat tier.</p>
              )}
              <p className="text-gtn-navy mt-1">
                Onboarding {fmtUsd(sticker.onboardingBase)} base + <span className="font-mono">{seats}</span> × {fmtUsd(sticker.onboardingPerSeat)}
                = <strong className="font-mono">{fmtUsd(sticker.onboardingTotal)}</strong> one-time
              </p>
              {sticker.annualAddOns.length > 0 && (
                <p className="text-xs text-gtn-grey-2 mt-1">
                  + Annual: {sticker.annualAddOns.map((a) => `${a.label} ${fmtUsd(a.amount)}`).join(" · ")}
                </p>
              )}
            </div>
          )}
          {isCustom && (
            <p className="text-xs text-gtn-grey-2 italic">
              Custom scope — enter the proposed numbers manually. No automatic sticker.
            </p>
          )}

          {/* What's included (service lines + sub-tier labels) */}
          {catalog && !isCustom && (
            <div className="rounded-md border border-gtn-lavender-2 p-3">
              <p className="text-xs uppercase tracking-wide text-gtn-grey-2 mb-2">{"What's included"}</p>
              <ul className="flex flex-wrap gap-1.5">
                {bundleIncludesNormalized(catalog.bundles[bundleId]).map((inc, i) => (
                  <li
                    key={`${inc.serviceLine}-${i}`}
                    className="text-[11px] bg-gtn-lavender text-gtn-navy rounded px-2 py-1"
                  >
                    <span className="font-semibold">{inc.serviceLine.replace(/_/g, " ")}</span>
                    {inc.tier && (
                      <span className="text-gtn-grey-2 ml-1">· {inc.tier}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Proposed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="gtn-eyebrow gtn-eyebrow--dark">Your proposed numbers</p>
              {sticker && !isCustom && (
                <button
                  type="button"
                  className="text-xs text-gtn-purple hover:text-gtn-purple-2 underline"
                  onClick={() => {
                    setProposedMrr(String(sticker.monthlyMrr));
                    setProposedOneTime(String(sticker.onboardingTotal));
                  }}
                >
                  Reset to sticker
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Proposed MRR ($/month)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={proposedMrr}
                  onChange={(e) => setProposedMrr(e.target.value)}
                  required
                  placeholder={sticker ? String(sticker.monthlyMrr) : "0"}
                />
                {sticker && !isCustom && (
                  <p className="text-[10px] text-gtn-grey-2">
                    Auto-filled from sticker ({fmtUsd(sticker.monthlyMrr)}/mo). Edit to apply a discount.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Proposed onboarding ($ one-time)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={proposedOneTime}
                  onChange={(e) => setProposedOneTime(e.target.value)}
                  placeholder={sticker ? String(sticker.onboardingTotal) : "0"}
                />
                {sticker && !isCustom && (
                  <p className="text-[10px] text-gtn-grey-2">
                    Auto-filled from sticker ({fmtUsd(sticker.onboardingTotal)}).
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Multi-year + reason */}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={multiYear}
              onChange={(e) => setMultiYear(e.target.checked)}
            />
            <span>Multi-year commit (locked pricing &gt; 12 months) — escalates to <GlossaryTerm term="below-floor pricing">COO regardless of %</GlossaryTerm></span>
            <FieldHelp>{HELP.pricing.multiYear}</FieldHelp>
          </label>

          {/* Live routing summary */}
          {sticker && (
            <div className="rounded-md border border-gtn-lavender-2 p-3 text-sm space-y-1">
              <p>
                Discount on MRR: <span className="font-mono">{pct.toFixed(1)}%</span>
                {previewTier === "SELF" && (
                  <> · <strong className="text-gtn-green">self-approves on submit</strong> (≤5% lane)</>
                )}
                {previewTier === "MANAGER" && (
                  <> · routes to <strong>Sales Manager</strong></>
                )}
                {previewTier === "COO" && (
                  <> · routes to <strong>COO</strong></>
                )}
                {previewTier === "NONE" && pct === 0 && proposedOneTimeN < sticker.onboardingTotal && (
                  <> · onboarding discount only — routes to <strong>Sales Manager</strong></>
                )}
              </p>
              {below && (
                <p className="text-gtn-red font-medium">
                  ⚠ Proposed MRR is below the floor {canSeeFloor ? `(${fmtUsd(sticker.monthlyFloor)}/mo)` : ""} —
                  approval forced to COO.
                </p>
              )}
              {multiYear && pct > 0 && !below && (
                <p className="text-gtn-amber text-xs">
                  Multi-year commit overrides the {previewTier === "COO" ? "" : "% bracket and "}routes to COO.
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label className="text-xs">Reason *</Label>
              <FieldHelp>{HELP.pricing.reason}</FieldHelp>
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} placeholder="Why is this discount warranted?" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !reason.trim() || !sticker || (pct === 0 && proposedOneTimeN >= sticker.onboardingTotal)}>
              {saving ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      )}

      {/* Existing approvals list */}
      {items === null ? (
        <p className="text-sm text-gtn-grey-2">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gtn-grey-2">No pricing requests yet.</p>
      ) : (
        <ul className="divide-y divide-gtn-lavender-2">
          {items.map((a) => {
            const effTier = a.belowFloor ? "COO" : approvalTier(Number(a.discountPct));
            const canDecide = a.status === "PENDING" && (
              (effTier === "MANAGER" && canApproveManager) ||
              (effTier === "COO" && canApproveCoo)
            );
            return (
              <li key={a.id} className="py-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gtn-navy">
                      {a.bundleId && <span className="mr-2">{a.bundleId.replace(/_/g, " ")}</span>}
                      {a.seatCount && <span className="text-gtn-grey-3 mr-2">· {a.seatCount} seats</span>}
                      {fmtUsd(Number(a.proposedPrice))}/mo <span className="text-gtn-grey-3">vs sticker {fmtUsd(Number(a.stickerPrice))}/mo</span> · <span className="font-mono">{Number(a.discountPct).toFixed(1)}%</span>
                    </p>
                    {(a.stickerOneTime || a.proposedOneTime) && (
                      <p className="text-xs text-gtn-grey-2">
                        Onboarding: {fmtUsd(Number(a.proposedOneTime ?? 0))} vs {fmtUsd(Number(a.stickerOneTime ?? 0))}
                      </p>
                    )}
                    <p className="text-xs text-gtn-grey-3">
                      {a.requester.name} · {format(new Date(a.createdAt), "PPp")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusPill status={a.status} />
                    {a.belowFloor && <span className="text-[10px] uppercase font-semibold text-gtn-red">below floor</span>}
                  </div>
                </div>
                <p className="text-xs text-gtn-grey-2">{a.reason}</p>
                {a.decisionNote && (
                  <p className="text-xs text-gtn-grey-2"><strong>Note:</strong> {a.decisionNote}</p>
                )}
                {canDecide && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => decide(a.id, "approve")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(a.id, "reject")}>Reject</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StatusPill({ status }: { status: ApprovalRow["status"] }) {
  const cls = status === "APPROVED"
    ? "bg-gtn-green-bg text-gtn-green"
    : status === "REJECTED"
    ? "bg-[#FBE9E7] text-gtn-red"
    : "bg-[#FEF3E2] text-gtn-amber";
  return <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{status}</span>;
}
