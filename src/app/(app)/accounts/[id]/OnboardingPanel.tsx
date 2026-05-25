"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, Plus, Printer, X } from "lucide-react";
import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  phase: OnboardingPhase;
  title: string;
  description: string | null;
  status: OnboardingTaskStatus;
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
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

const PHASE_SHORT: Record<OnboardingPhase, string> = {
  PRE_ENGAGEMENT: "pre-engage",
  DISCOVERY: "discovery",
  ONBOARD: "onboard",
  STABILIZE: "stabilize",
  STEADY_STATE: "steady",
};

const STATUS_TONE: Record<OnboardingTaskStatus, "neutral" | "brand" | "success" | "warn" | "danger"> = {
  PENDING: "neutral",
  IN_PROGRESS: "brand",
  DONE: "success",
  SKIPPED: "warn",
  BLOCKED: "danger",
};

/**
 * v3.1.4 — Onboarding panel rebuilt on v3 tokens.
 * Phase accordions, ownership chips, progress bars + add-task inline form.
 */
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading onboarding tasks…
      </div>
    );
  }

  // Ownership bucketing — by assignee or by role default.
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

  // Phase progress.
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
    <div className="space-y-4">
      {/* Task ownership strip */}
      {roleStrip.length > 0 && (
        <div className="rounded-xl bg-surface border border-line-subtle p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-ink-strong">Task ownership</h3>
            <p className="text-[11px] text-ink-faint uppercase tracking-wide font-semibold">Open · Done</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {roleStrip.map((b) => (
              <div
                key={b.key}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border",
                  b.open > 0
                    ? "bg-brand-soft text-gtn-navy border-transparent"
                    : "bg-success-soft text-gtn-green border-transparent",
                )}
                title={`${b.open} open, ${b.done} done`}
              >
                <span className="font-semibold capitalize">{b.label}</span>
                <span className="font-mono tabular">{b.open}</span>
                <span className="text-ink-faint">·</span>
                <span className="font-mono tabular opacity-70">{b.done} ✓</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phase progress bar */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-strong">Onboarding progress</h3>
          <p className="text-xs text-ink-muted">
            Current: <strong className="text-gtn-purple">{PHASE_LABEL[currentPhase]}</strong>
          </p>
        </div>
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {phaseProgress.map((p) => {
            const isCurrent = p.phase === currentPhase;
            const complete = p.pct === 100 && p.total > 0;
            const fillClass = complete
              ? "bg-gtn-green"
              : isCurrent
              ? "bg-gtn-purple"
              : p.done > 0
              ? "bg-gtn-purple/50"
              : "bg-line";
            return (
              <div key={p.phase} className="text-center">
                <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={cn("h-full transition-all", fillClass)}
                    style={{ width: `${Math.max(p.pct, p.total === 0 ? 0 : 4)}%` }}
                  />
                </div>
                <p className="text-[10px] uppercase tracking-wide text-ink-muted mt-1.5 truncate font-semibold">
                  {PHASE_SHORT[p.phase]}
                </p>
                <p className="text-xs font-mono tabular text-ink-strong">{p.done}/{p.total}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inline toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <AddTaskInline customerId={customerId} onCreated={refresh} />
        <a
          href={`/accounts/${customerId}/onboarding/print`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-gtn-purple transition-colors"
        >
          <Printer className="h-3.5 w-3.5" />
          Print checklist
        </a>
      </div>

      {/* Per-phase accordions */}
      {PHASES.map((phase) => {
        const phaseTasks = tasks.filter((t) => t.phase === phase).sort((a, b) => a.position - b.position);
        const done = phaseTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
        const pct = phaseTasks.length === 0 ? 0 : Math.round((done / phaseTasks.length) * 100);
        const isCurrent = phase === currentPhase;
        const open = openPhases.has(phase);
        return (
          <div key={phase} className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
            <button
              type="button"
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-3/40 transition-colors"
              onClick={() => togglePhase(phase)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {open ? (
                  <ChevronDown className="h-4 w-4 text-ink-muted flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-ink-muted flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-strong">
                    {PHASE_LABEL[phase]}
                    {isCurrent && (
                      <Badge tone="accent" shape="pill" size="xs" className="ml-2">current</Badge>
                    )}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {done}/{phaseTasks.length} complete · <span className="tabular">{pct}%</span>
                  </p>
                </div>
              </div>
              <div className="w-24 h-1.5 rounded-full bg-surface-3 overflow-hidden flex-shrink-0">
                <div
                  className={cn("h-full", pct === 100 && phaseTasks.length > 0 ? "bg-gtn-green" : "bg-gtn-purple")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
            {open && (
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {phaseTasks.length === 0 ? (
                  <li className="px-4 py-4 text-sm text-ink-faint italic">No tasks in this phase.</li>
                ) : (
                  phaseTasks.map((t) => {
                    const isDone = t.status === "DONE" || t.status === "SKIPPED";
                    return (
                      <li key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-surface-3/30 transition-colors">
                        <select
                          value={t.status}
                          onChange={(e) => updateTask(t.id, { status: e.target.value as OnboardingTaskStatus })}
                          className={cn(
                            "h-7 rounded-full border px-2.5 text-[10px] uppercase font-semibold tracking-wide cursor-pointer flex-shrink-0 mt-0.5",
                            "focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors",
                            STATUS_TONE[t.status] === "success" && "bg-success-soft text-gtn-green border-transparent",
                            STATUS_TONE[t.status] === "brand"   && "bg-brand-soft text-gtn-navy border-transparent",
                            STATUS_TONE[t.status] === "warn"    && "bg-warn-soft text-gtn-amber border-transparent",
                            STATUS_TONE[t.status] === "danger"  && "bg-danger-soft text-gtn-red border-transparent",
                            STATUS_TONE[t.status] === "neutral" && "bg-surface-3 text-ink-strong border-line-subtle",
                          )}
                          aria-label={`Status of ${t.title}`}
                        >
                          {(Object.values(OnboardingTaskStatus) as OnboardingTaskStatus[]).map((s) => (
                            <option key={s} value={s} className="bg-surface text-ink-strong">
                              {s.toLowerCase().replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm",
                            isDone ? "line-through text-ink-faint" : "font-medium text-ink-strong",
                          )}>
                            {t.title}
                          </p>
                          {t.description && (
                            <p className="text-xs text-ink-muted mt-1">{t.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs text-ink-faint flex-wrap">
                            <Input
                              type="date"
                              value={t.dueAt ? t.dueAt.slice(0, 10) : ""}
                              onChange={(e) => updateTask(t.id, {
                                dueAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                              })}
                              className="h-7 px-2 text-xs w-36"
                            />
                            {t.completedAt && (
                              <span className="text-gtn-green tabular">
                                ✓ {format(new Date(t.completedAt), "MMM d")}
                              </span>
                            )}
                            {t.owner && <span>owner: <span className="text-ink-muted font-medium">{t.owner.name}</span></span>}
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
        className="inline-flex items-center gap-1.5 text-xs text-gtn-purple hover:underline font-medium"
      >
        <Plus className="h-3.5 w-3.5" />
        Add ad-hoc task
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2 flex-wrap rounded-lg border-l-4 border-gtn-purple bg-brand-soft/40 px-3 py-2.5">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide text-ink-muted">Phase</Label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as OnboardingPhase)}
          className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink-strong"
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
      <Button size="sm" onClick={submit} disabled={submitting || !title.trim()}>
        {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
        Add
      </Button>
      <button
        onClick={() => { setOpen(false); setTitle(""); setDueAt(""); }}
        disabled={submitting}
        className="text-xs text-ink-muted hover:text-ink-strong transition-colors p-1.5"
        aria-label="Cancel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
