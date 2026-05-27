"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import { STRINGS } from "@/lib/strings";
import { scoreBadgeClass, formatScore } from "@/lib/utils";
import { toast } from "sonner";
import { ALL_STAGES, LAST_ACTIVE_STAGE_INDEX } from "@/lib/pipeline/stages";

export { ALL_STAGES };

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

const LAST_ACTIVE_INDEX = LAST_ACTIVE_STAGE_INDEX;

type HardBlock = {
  leadId: string;
  toStage: PipelineStage;
  reasons: string[];
};

export function PipelineBoard({ leads }: { leads: LeadCardData[] }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(leads);
  const [, startTransition] = useTransition();
  const [hardBlock, setHardBlock] = useState<HardBlock | null>(null);

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
      if (res.status === 422) {
        // Hard block — required data missing or role not allowed.
        const data = await res.json().catch(() => ({}));
        const reasons: string[] = data.reasons ?? data.errors ?? [data.error ?? "Required data missing"];
        setOptimistic((cur) => cur.map((l) => (l.id === id ? { ...l, pipelineStage: prev } : l)));
        setHardBlock({ leadId: id, toStage, reasons });
        return;
      }
      if (res.status === 409) {
        // Soft gate warning — let the salesperson decide.
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
      {hardBlock && (
        <HardBlockModal
          block={hardBlock}
          onClose={() => setHardBlock(null)}
        />
      )}
    </div>
  );
}

function HardBlockModal({
  block,
  onClose,
}: {
  block: HardBlock;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gtn-navy">
          Can&apos;t move to {STRINGS.pipeline.stages[block.toStage]}
        </h2>
        <p className="mt-1 text-xs text-gtn-grey-2">
          Required information is missing. Fix the issues below on the lead detail page, then try again.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gtn-navy">
          {block.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-gtn-red">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-gtn-lavender text-gtn-navy"
            onClick={onClose}
          >
            Close
          </button>
          <Link
            href={`/leads/${block.leadId}`}
            className="px-3 py-1.5 text-sm rounded bg-gtn-navy text-white"
          >
            Open lead page
          </Link>
        </div>
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
  // Linear progression along the 8 active stages (LEAD → NEGOTIATION).
  // CLOSED_WON / CLOSED_LOST are terminals reached via explicit close
  // controls on the Lead detail page.
  const idx = ALL_STAGES.indexOf(currentStage);
  const prev = idx > 0 && idx <= LAST_ACTIVE_INDEX ? ALL_STAGES[idx - 1] : null;
  const next = idx < LAST_ACTIVE_INDEX ? ALL_STAGES[idx + 1] : null;
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
