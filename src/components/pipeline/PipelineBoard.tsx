"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import { STRINGS } from "@/lib/strings";
import { scoreBadgeClass, formatScore } from "@/lib/utils";
import { toast } from "sonner";

type LeadCardData = {
  id: string;
  businessName: string;
  industry: string;
  pipelineStage: PipelineStage;
  dealQualityScore: number;
  servicesScore: number;
  customerScore: number;
  nonStrategicFlag: boolean;
  primaryContactName: string | null;
  seatCount: number | null;
  updatedAt: Date;
};

const ALL_STAGES: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.DISCOVERY,
  PipelineStage.PRE_SALES,
  PipelineStage.PROPOSAL,
  PipelineStage.NEGOTIATION,
  PipelineStage.CLOSED_WON,
  PipelineStage.CLOSED_LOST,
  PipelineStage.NURTURE,
];

export function PipelineBoard({ leads }: { leads: LeadCardData[] }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(leads);
  const [, startTransition] = useTransition();

  async function moveLead(id: string, toStage: PipelineStage, acknowledgeWarnings = false) {
    const prev = optimistic.find((l) => l.id === id)?.pipelineStage;
    if (!prev || prev === toStage) return;
    setOptimistic((cur) => cur.map((l) => (l.id === id ? { ...l, pipelineStage: toStage } : l)));
    try {
      const res = await fetch(`/api/leads/${id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: toStage, acknowledgeWarnings }),
      });
      if (res.status === 409) {
        // Gate warnings — let the salesperson decide.
        const data = await res.json();
        const warnings: string[] = data.warnings ?? [];
        const ok = window.confirm(
          `Phase gate warning before moving to ${STRINGS.pipeline.stages[toStage]}:\n\n` +
          warnings.map((w) => `• ${w}`).join("\n") +
          "\n\nProceed anyway?",
        );
        if (ok) {
          await moveLead(id, toStage, true);
          return;
        } else {
          setOptimistic((cur) => cur.map((l) => (l.id === id ? { ...l, pipelineStage: prev } : l)));
          return;
        }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Stage change failed");
      }
      toast.success(`Moved to ${STRINGS.pipeline.stages[toStage]}`);
      startTransition(() => router.refresh());
    } catch (err) {
      setOptimistic((cur) => cur.map((l) => (l.id === id ? { ...l, pipelineStage: prev } : l)));
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const byStage = ALL_STAGES.reduce<Record<string, LeadCardData[]>>((acc, s) => {
    acc[s] = optimistic.filter((l) => l.pipelineStage === s);
    return acc;
  }, {});

  return (
    <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0">
      <div className="flex gap-3 min-w-max pb-2">
        {ALL_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            leads={byStage[stage] ?? []}
            onDropMove={moveLead}
          />
        ))}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  leads,
  onDropMove,
}: {
  stage: PipelineStage;
  leads: LeadCardData[];
  onDropMove: (id: string, toStage: PipelineStage) => void;
}) {
  return (
    <div
      className="w-[260px] md:w-auto shrink-0 rounded-lg bg-gtn-lavender p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropMove(id, stage);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gtn-navy">{STRINGS.pipeline.stages[stage]}</h3>
        <span className="text-xs text-gtn-grey-2 font-mono">{leads.length}</span>
      </div>
      <div className="space-y-2">
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} onDropMove={onDropMove} />
        ))}
        {leads.length === 0 && (
          <p className="text-xs text-gtn-grey-3 text-center py-6">No leads in this stage</p>
        )}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  onDropMove,
}: {
  lead: LeadCardData;
  onDropMove: (id: string, toStage: PipelineStage) => void;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
      className="block bg-white rounded-md border border-gtn-lavender-2 p-3 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gtn-navy truncate">{lead.businessName}</p>
          <p className="text-xs text-gtn-grey-2 truncate">
            {lead.industry.replace(/_/g, " ")}
            {lead.seatCount ? ` · ${lead.seatCount} seats` : ""}
          </p>
        </div>
        <span className={scoreBadgeClass(lead.dealQualityScore)}>
          {formatScore(lead.dealQualityScore)}
        </span>
      </div>
      {lead.nonStrategicFlag && (
        <span className="inline-block mt-2 text-[10px] font-medium uppercase tracking-wide text-gtn-red">
          Non-strategic
        </span>
      )}
      {/* Mobile: also expose stage-change buttons for keyboard/non-DnD users */}
      <div className="md:hidden mt-3 flex flex-wrap gap-1">
        <StageQuickButtons currentStage={lead.pipelineStage} onPick={(s) => onDropMove(lead.id, s)} />
      </div>
    </Link>
  );
}

function StageQuickButtons({
  currentStage,
  onPick,
}: {
  currentStage: PipelineStage;
  onPick: (s: PipelineStage) => void;
}) {
  // Linear progression only — active stages 0..5 (LEAD → NEGOTIATION).
  // Terminal stages (CLOSED_WON / CLOSED_LOST / NURTURE) are reached via the
  // explicit "Close deal" controls on the Lead detail page.
  const idx = ALL_STAGES.indexOf(currentStage);
  const prev = idx > 0 && idx <= 5 ? ALL_STAGES[idx - 1] : null;
  const next = idx < 5 ? ALL_STAGES[idx + 1] : null;
  return (
    <>
      {prev && (
        <button
          type="button"
          className="text-[11px] px-2 py-1 rounded bg-gtn-lavender text-gtn-navy"
          onClick={(e) => {
            e.preventDefault();
            onPick(prev);
          }}
        >
          ← {STRINGS.pipeline.stages[prev]}
        </button>
      )}
      {next && (
        <button
          type="button"
          className="text-[11px] px-2 py-1 rounded bg-gtn-navy text-white"
          onClick={(e) => {
            e.preventDefault();
            onPick(next);
          }}
        >
          {STRINGS.pipeline.stages[next]} →
        </button>
      )}
    </>
  );
}
