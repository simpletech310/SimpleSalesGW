"use client";

import { useEffect, useState } from "react";
import type { TimelineSegment } from "@/lib/timeline/stages";

/**
 * 14-segment unified process timeline.
 *
 * Renders Lead pipeline + Customer onboarding side-by-side as a single horizontal
 * row. Embeds on Lead detail header (driven by /api/leads/[id]/timeline) and
 * Customer detail header (driven by /api/customers/[id]/timeline).
 */
export function StageTimeline({ leadId }: { leadId: string }) {
  const [segments, setSegments] = useState<TimelineSegment[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/leads/${leadId}/timeline`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) setSegments(data.segments as TimelineSegment[]);
    })();
    return () => { cancelled = true; };
  }, [leadId]);

  if (!segments) {
    return <div className="h-12 w-full bg-gtn-lavender rounded animate-pulse" aria-hidden />;
  }

  return (
    <div className="rounded-md bg-white border border-gtn-lavender-2 p-3 overflow-x-auto">
      <div className="flex items-stretch min-w-max gap-1">
        {segments.map((seg, idx) => {
          const prev = segments[idx - 1];
          const isLaneBoundary = prev && prev.side !== seg.side;
          return (
            <SegmentChip key={seg.key} seg={seg} laneBoundary={!!isLaneBoundary} />
          );
        })}
      </div>
      <Legend />
    </div>
  );
}

function SegmentChip({ seg, laneBoundary }: { seg: TimelineSegment; laneBoundary: boolean }) {
  const stateColor: Record<TimelineSegment["state"], string> = {
    completed: "bg-gtn-green-bg text-gtn-green border-gtn-green",
    current:   "bg-gtn-navy text-white border-gtn-navy",
    future:    "bg-white text-gtn-grey-2 border-gtn-lavender-2",
    dormant:   "bg-gtn-lavender text-gtn-grey-3 border-gtn-lavender-2 opacity-60",
  };
  const gateIcon = seg.gate === "passed" ? "✓" : seg.gate === "blocked" ? "⚠" : null;
  const gateClass = seg.gate === "passed" ? "text-gtn-green" : seg.gate === "blocked" ? "text-gtn-amber" : "text-gtn-grey-2";

  return (
    <>
      {laneBoundary && (
        <div className="self-stretch flex items-center px-1">
          <div className="border-l-2 border-dashed border-gtn-purple h-12" title="Sales → Ops boundary" />
        </div>
      )}
      <div
        className={`rounded border px-2.5 py-1.5 min-w-[64px] text-center ${stateColor[seg.state]}`}
        title={`${seg.label}${seg.daysInStage !== undefined ? ` · ${seg.daysInStage}d` : ""}${seg.gateNote ? `\n\n${seg.gateNote}` : ""}`}
      >
        <p className="text-[10px] uppercase tracking-wide font-semibold leading-tight">
          {seg.short}
        </p>
        {seg.state === "current" && seg.daysInStage !== undefined && (
          <p className="text-[9px] font-mono opacity-80">{seg.daysInStage}d</p>
        )}
        {gateIcon && <span className={`text-[10px] font-semibold ${gateClass}`}>{gateIcon}</span>}
      </div>
    </>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 mt-2 text-[10px] text-gtn-grey-2 flex-wrap">
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded bg-gtn-green-bg border border-gtn-green" /> completed
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded bg-gtn-navy" /> current
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded bg-white border border-gtn-lavender-2" /> future
      </span>
      <span className="inline-flex items-center gap-1 text-gtn-green">✓ gate passed</span>
      <span className="inline-flex items-center gap-1 text-gtn-amber">⚠ gate blocked</span>
    </div>
  );
}
