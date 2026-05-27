import Link from "next/link";
import { PipelineStage } from "@prisma/client";
import { STRINGS } from "@/lib/strings";
import { ALL_STAGES } from "@/lib/pipeline/stages";

/**
 * Compact pipeline-shape strip rendered on every role's home dashboard.
 * Renders the 10 canonical stages as count pills that deep-link into the
 * full /pipeline kanban filtered to that stage. No drag-and-drop here —
 * that lives on /pipeline.
 */
export function PipelineStrip({
  counts,
  stages = ALL_STAGES,
  heading = "Pipeline shape",
}: {
  counts: Partial<Record<PipelineStage, number>>;
  stages?: ReadonlyArray<PipelineStage>;
  heading?: string;
}) {
  return (
    <section className="rounded-xl bg-surface border border-line-subtle">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line-subtle">
        <div>
          <h3 className="text-sm font-semibold text-ink-strong">{heading}</h3>
          <p className="text-[11px] text-ink-muted">Click any stage to jump into the full board.</p>
        </div>
        <Link
          href="/pipeline"
          className="text-xs font-medium text-gtn-navy hover:text-gtn-purple"
        >
          Open pipeline →
        </Link>
      </header>
      <div className="overflow-x-auto">
        <ul className="flex gap-2 px-4 py-3 min-w-max">
          {stages.map((stage) => {
            const count = counts[stage] ?? 0;
            const isTerminal = stage === PipelineStage.CLOSED_WON || stage === PipelineStage.CLOSED_LOST;
            const tone =
              stage === PipelineStage.CLOSED_WON
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : stage === PipelineStage.CLOSED_LOST
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-gtn-lavender border-gtn-lavender-2 text-gtn-navy";
            return (
              <li key={stage}>
                <Link
                  href={`/pipeline?stage=${stage}`}
                  className={`flex flex-col items-center min-w-[112px] rounded-lg border px-3 py-2 hover:shadow-sm transition ${tone}`}
                >
                  <span className="text-[11px] uppercase tracking-wide font-semibold opacity-80">
                    {STRINGS.pipeline.stages[stage]}
                  </span>
                  <span className={`text-lg font-mono font-bold mt-0.5 ${isTerminal ? "opacity-70" : ""}`}>
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
