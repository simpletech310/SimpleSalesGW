"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { OnboardingPhase, OnboardingTaskStatus } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

import { Role } from "@prisma/client";

type Task = {
  id: string;
  phase: OnboardingPhase;
  title: string;
  description: string | null;
  status: OnboardingTaskStatus;
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
  // v2.16 — role bucket the task defaults to (assigned at customer create).
  ownerRole: Role | null;
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

  // v2.16 — per-role ownership strip. Confirms every role on the team
  // has skin in the game on this customer — nothing falls through cracks.
  // Bucket by the assignee's name when set, otherwise by role.
  type RoleBucket = { key: string; label: string; open: number; done: number };
  const bucketMap = new Map<string, RoleBucket>();
  for (const t of tasks) {
    const isDone = t.status === "DONE" || t.status === "SKIPPED";
    const key = t.ownerUserId && t.owner
      ? `user:${t.ownerUserId}`
      : `role:${t.ownerRole ?? "UNASSIGNED"}`;
    const label = t.ownerUserId && t.owner
      ? t.owner.name
      : (t.ownerRole ?? "Unassigned").replace(/_/g, " ").toLowerCase();
    const b = bucketMap.get(key) ?? { key, label, open: 0, done: 0 };
    if (isDone) b.done += 1; else b.open += 1;
    bucketMap.set(key, b);
  }
  const roleStrip = Array.from(bucketMap.values()).sort((a, b) => b.open - a.open);

  // v2.14 — phase progress bar. Calculates % done per phase based on
  // task completion. Gives the vCIO an at-a-glance "where is this
  // customer in the onboarding lifecycle?" without scrolling.
  const phaseProgress = PHASES.map((p) => {
    const inPhase = tasks.filter((t) => t.phase === p);
    const done = inPhase.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
    return {
      phase: p,
      pct: inPhase.length === 0 ? 0 : Math.round((done / inPhase.length) * 100),
      total: inPhase.length,
      done,
    };
  });

  return (
    <div className="space-y-3">
      {/* v2.16 — Who owns what on this customer */}
      {roleStrip.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gtn-navy">Task ownership</h3>
            <p className="text-xs text-gtn-grey-2">Open · Done per person/role</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {roleStrip.map((b) => (
              <div
                key={b.key}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
                  b.open > 0 ? "bg-gtn-lavender text-gtn-navy" : "bg-gtn-green-bg text-gtn-green"
                }`}
                title={`${b.open} open, ${b.done} done`}
              >
                <span className="font-semibold capitalize">{b.label}</span>
                <span className="font-mono">{b.open}</span>
                <span className="text-gtn-grey-3">·</span>
                <span className="font-mono text-gtn-grey-3">{b.done} ✓</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Phase progress bar */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gtn-navy">Onboarding progress</h3>
          <p className="text-xs text-gtn-grey-2">
            Current phase: <strong className="text-gtn-purple">{PHASE_LABEL[currentPhase]}</strong>
          </p>
        </div>
        {/* v2.18 — mobile: tighten gap so 5 phases fit; truncated labels handle the rest. */}
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {phaseProgress.map((p) => {
            const isCurrent = p.phase === currentPhase;
            const complete = p.pct === 100 && p.total > 0;
            const bgClass = complete
              ? "bg-gtn-green"
              : isCurrent
              ? "bg-gtn-purple"
              : p.done > 0
              ? "bg-gtn-purple/50"
              : "bg-gtn-lavender-2";
            return (
              <div key={p.phase} className="text-center">
                <div className="h-2 rounded-full bg-gtn-lavender-2 overflow-hidden">
                  <div
                    className={`h-full ${bgClass}`}
                    style={{ width: `${Math.max(p.pct, p.total === 0 ? 0 : 4)}%` }}
                  />
                </div>
                <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2 mt-1 truncate">
                  {p.phase.replace(/_/g, " ").toLowerCase()}
                </p>
                <p className="text-xs font-mono text-gtn-navy">
                  {p.done}/{p.total}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <AddTaskInline customerId={customerId} onCreated={refresh} />
        <a
          href={`/accounts/${customerId}/onboarding/print`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gtn-purple underline"
        >
          Print checklist →
        </a>
      </div>
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

/**
 * Inline "Add task" form — collapsed by default. Lets the vCIO add an
 * ad-hoc onboarding task outside the template + QBR auto-spawn flows.
 */
function AddTaskInline({ customerId, onCreated }: { customerId: string; onCreated: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>(OnboardingPhase.PRE_ENGAGEMENT);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  async function submit() {
    if (!title.trim()) { toast.error("Task title is required."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${customerId}/onboarding/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          title: title.trim(),
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error ?? "Failed"); return; }
      toast.success("Task added");
      setTitle(""); setDueAt(""); setOpen(false);
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-gtn-purple hover:text-gtn-purple-2 underline"
      >
        + Add ad-hoc task
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2 flex-wrap bg-gtn-callout-bg border-l-4 border-gtn-purple rounded px-3 py-2">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-gtn-grey-2">Phase</label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as OnboardingPhase)}
          className="h-8 rounded border border-input bg-white px-2 text-xs"
        >
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABEL[p]}</option>)}
        </select>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title (e.g. Schedule security review)"
        className="h-8 text-xs flex-1 min-w-[200px]"
      />
      <Input
        type="date"
        value={dueAt}
        onChange={(e) => setDueAt(e.target.value)}
        className="h-8 text-xs w-36"
      />
      <button onClick={submit} disabled={submitting || !title.trim()} className="text-xs bg-gtn-purple text-white px-3 h-8 rounded disabled:opacity-60">
        {submitting ? "…" : "Add"}
      </button>
      <button onClick={() => { setOpen(false); setTitle(""); setDueAt(""); }} disabled={submitting} className="text-xs text-gtn-grey-2 hover:text-gtn-navy">
        Cancel
      </button>
    </div>
  );
}
