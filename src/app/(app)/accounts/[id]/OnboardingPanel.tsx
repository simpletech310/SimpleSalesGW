"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { OnboardingPhase, OnboardingTaskStatus } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Task = {
  id: string;
  phase: OnboardingPhase;
  title: string;
  description: string | null;
  status: OnboardingTaskStatus;
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
  dueAt: string | null;
  completedAt: string | null;
  position: number;
};

const PHASES: OnboardingPhase[] = [
  OnboardingPhase.PRE_ENGAGEMENT,
  OnboardingPhase.DISCOVERY,
  OnboardingPhase.ONBOARD,
  OnboardingPhase.STABILIZE,
  OnboardingPhase.STEADY_STATE,
];

const PHASE_LABEL: Record<OnboardingPhase, string> = {
  PRE_ENGAGEMENT: "Phase 0 · Pre-Engagement",
  DISCOVERY: "Phase 1 · Discovery",
  ONBOARD: "Phase 2 · Onboard",
  STABILIZE: "Phase 3 · Stabilize",
  STEADY_STATE: "Phase 4 · Steady State",
};

export function OnboardingPanel({ customerId, currentPhase }: { customerId: string; currentPhase: OnboardingPhase }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPhases, setOpenPhases] = useState<Set<OnboardingPhase>>(new Set([currentPhase]));

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/accounts/${customerId}/onboarding/tasks`);
    if (!res.ok) return;
    const data = await res.json();
    setTasks(data.tasks);
    setLoading(false);
  }, [customerId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function updateTask(taskId: string, patch: Partial<{ status: OnboardingTaskStatus; dueAt: string | null }>) {
    const prev = tasks;
    // optimistic
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    try {
      const res = await fetch(`/api/accounts/${customerId}/onboarding/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? "Update failed");
        setTasks(prev);
      } else {
        router.refresh();
      }
    } catch {
      setTasks(prev);
      toast.error("Network error");
    }
  }

  function togglePhase(p: OnboardingPhase) {
    setOpenPhases((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  if (loading) return <p className="text-sm text-gtn-grey-2">Loading…</p>;

  return (
    <div className="space-y-3">
      {PHASES.map((phase) => {
        const phaseTasks = tasks.filter((t) => t.phase === phase).sort((a, b) => a.position - b.position);
        const done = phaseTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
        const pct = phaseTasks.length === 0 ? 0 : Math.round((done / phaseTasks.length) * 100);
        const isCurrent = phase === currentPhase;
        const open = openPhases.has(phase);
        return (
          <Card key={phase} className="p-0 overflow-hidden">
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gtn-lavender/40"
              onClick={() => togglePhase(phase)}
            >
              <div>
                <p className="text-sm font-semibold text-gtn-navy">
                  {PHASE_LABEL[phase]}
                  {isCurrent && (
                    <span className="ml-2 text-[10px] uppercase font-semibold text-gtn-purple">current</span>
                  )}
                </p>
                <p className="text-xs text-gtn-grey-2">
                  {done}/{phaseTasks.length} complete · {pct}%
                </p>
              </div>
              <div className="text-gtn-grey-2 text-sm">{open ? "▾" : "▸"}</div>
            </button>
            {open && (
              <ul className="divide-y divide-gtn-lavender-2 border-t border-gtn-lavender-2">
                {phaseTasks.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gtn-grey-2">No tasks in this phase.</li>
                ) : (
                  phaseTasks.map((t) => (
                    <li key={t.id} className="px-4 py-3 flex items-start gap-3">
                      <select
                        value={t.status}
                        onChange={(e) => updateTask(t.id, { status: e.target.value as OnboardingTaskStatus })}
                        className="h-8 rounded border border-input bg-white px-2 text-xs"
                        aria-label={`Status of ${t.title}`}
                      >
                        {(Object.values(OnboardingTaskStatus) as OnboardingTaskStatus[]).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <div className="flex-1 min-w-0">
                        <p className={t.status === "DONE" || t.status === "SKIPPED" ? "text-sm line-through text-gtn-grey-2" : "text-sm font-medium text-gtn-navy"}>
                          {t.title}
                        </p>
                        {t.description && <p className="text-xs text-gtn-grey-2 mt-1">{t.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gtn-grey-3">
                          <Input
                            type="date"
                            value={t.dueAt ? t.dueAt.slice(0, 10) : ""}
                            onChange={(e) => updateTask(t.id, { dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                            className="h-7 px-2 text-xs w-36"
                          />
                          {t.completedAt && <span className="text-gtn-green">✓ {format(new Date(t.completedAt), "PP")}</span>}
                          {t.owner && <span>· owner: {t.owner.name}</span>}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
