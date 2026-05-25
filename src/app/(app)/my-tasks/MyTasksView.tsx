"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/help/EmptyState";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  phase: OnboardingPhase;
  title: string;
  description: string | null;
  status: OnboardingTaskStatus;
  dueAt: string | null;
  ownerRole: Role | null;
  customer: { id: string; lead: { businessName: string } };
  owner: { id: string; name: string } | null;
};

const PHASE_LABEL: Record<OnboardingPhase, string> = {
  PRE_ENGAGEMENT: "Pre-engagement",
  DISCOVERY:      "Discovery",
  ONBOARD:        "Onboard",
  STABILIZE:      "Stabilize",
  STEADY_STATE:   "Steady state",
};

const ROLE_LABEL: Record<Role, string> = {
  SALESPERSON:    "Salesperson",
  SALES_MANAGER:  "Sales Manager",
  VCIO:           "vCIO",
  COO:            "COO",
  SUPERADMIN:     "Superadmin",
};

export function MyTasksView({
  initialTasks,
  userRole,
  lens,
  includeDone,
}: {
  initialTasks: Task[];
  userRole: Role;
  lens: Role;
  includeDone: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [bulkBusy, setBulkBusy] = useState(false);

  function setUrlParam(name: string, value: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (value === null || value === "") params.delete(name);
    else params.set(name, value);
    const q = params.toString();
    router.push(`/my-tasks${q ? `?${q}` : ""}`);
    router.refresh();
  }

  async function updateStatus(taskId: string, status: OnboardingTaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const prev = task.status;
    setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const res = await fetch(`/api/accounts/${task.customer.id}/onboarding/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error ?? "Update failed");
      setTasks((cur) => cur.map((t) => (t.id === taskId ? { ...t, status: prev } : t)));
    } else {
      router.refresh();
    }
  }

  async function bulkMarkDone(taskIds: string[]) {
    if (taskIds.length === 0) return;
    if (!confirm(`Mark ${taskIds.length} task${taskIds.length === 1 ? "" : "s"} DONE?`)) return;
    setBulkBusy(true);
    try {
      const idTasks = tasks.filter((t) => taskIds.includes(t.id));
      await Promise.all(
        idTasks.map((t) =>
          fetch(`/api/accounts/${t.customer.id}/onboarding/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: OnboardingTaskStatus.DONE }),
          }),
        ),
      );
      setTasks((cur) =>
        cur.map((t) => (taskIds.includes(t.id) ? { ...t, status: OnboardingTaskStatus.DONE } : t)),
      );
      toast.success(`${taskIds.length} marked DONE`);
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  // Group by customer for the main view; secondary grouping by phase.
  const grouped = useMemo(() => {
    const out = new Map<string, { customerName: string; customerId: string; tasks: Task[] }>();
    for (const t of tasks) {
      const cid = t.customer.id;
      if (!out.has(cid)) out.set(cid, { customerName: t.customer.lead.businessName, customerId: cid, tasks: [] });
      out.get(cid)!.tasks.push(t);
    }
    return Array.from(out.values()).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [tasks]);

  const canLens = userRole === Role.SUPERADMIN;

  return (
    <>
      {/* Toolbar — role lens + done toggle + count */}
      <div className="rounded-xl bg-surface border border-line-subtle px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="inline-flex items-center gap-2 text-sm">
            <span className="ui-label">Role lens</span>
            <select
              value={lens}
              onChange={(e) => setUrlParam("role", e.target.value === userRole ? null : e.target.value)}
              disabled={!canLens && lens !== userRole}
              className={cn(
                "h-8 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-strong",
                "hover:border-line-strong",
                "focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "transition-colors duration-120 ease-smooth",
              )}
              title={canLens ? "Lens into any role" : "Locked to your role"}
            >
              {(Object.values(Role) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </label>

          <span className="hidden sm:inline-block w-px h-5 bg-line-subtle mx-1" aria-hidden />

          <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDone}
              onChange={(e) => setUrlParam("includeDone", e.target.checked ? "true" : null)}
              className="w-3.5 h-3.5 rounded border-line text-brand focus:ring-2 focus:ring-brand/30 cursor-pointer"
            />
            <span className="text-ink">Include done / skipped</span>
          </label>

          {!canLens && (
            <span className="text-[10px] text-ink-faint italic ml-1">
              Superadmins can lens into any role
            </span>
          )}
        </div>

        <div className="text-xs text-ink-muted tabular">
          <span className="font-semibold text-ink-strong">{tasks.length}</span>{" "}
          task{tasks.length === 1 ? "" : "s"}
          <span className="text-line-strong mx-1.5">·</span>
          <span className="font-semibold text-ink-strong">{grouped.length}</span>{" "}
          customer{grouped.length === 1 ? "" : "s"}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          Icon={includeDone ? ClipboardList : CheckCircle2}
          title={includeDone ? "No tasks yet" : "You're all caught up"}
          body={
            includeDone
              ? "No onboarding tasks have rolled out for this role yet. They'll appear here as customers move through Discovery → Onboard → Stabilize."
              : "Nothing on your plate right now. Tasks land here automatically as customers hit each onboarding phase — check back after the next handoff."
          }
          /* v3.0.7 — CTA points back to the surface that matters for the
             viewer's role. Salespeople don't see /accounts (it's blocked
             for them), so send them to /leads where they actually work. */
          cta={
            userRole === Role.SALESPERSON
              ? { label: "Open leads", href: "/leads" }
              : { label: "Open accounts", href: "/accounts" }
          }
          secondaryCta={{ label: "Open help center", href: "/help" }}
        />
      ) : (
        grouped.map((group) => {
          const openIds = group.tasks
            .filter((t) => t.status !== OnboardingTaskStatus.DONE && t.status !== OnboardingTaskStatus.SKIPPED)
            .map((t) => t.id);
          return (
            <section
              key={group.customerId}
              className="rounded-xl bg-surface border border-line-subtle overflow-hidden"
            >
              <header className="flex items-center justify-between gap-3 flex-wrap px-4 md:px-5 py-3 border-b border-line-subtle bg-surface-2/60">
                <h2 className="text-sm font-semibold text-ink-strong">
                  <Link href={`/accounts/${group.customerId}`} className="hover:text-gtn-purple transition-colors">
                    {group.customerName}
                  </Link>
                  <span className="text-ink-muted font-normal ml-2 tabular">({group.tasks.length})</span>
                </h2>
                {openIds.length > 0 && (
                  <Button size="xs" variant="secondary" disabled={bulkBusy} onClick={() => bulkMarkDone(openIds)}>
                    Mark all {openIds.length} done
                  </Button>
                )}
              </header>
              <ul className="divide-y divide-line-subtle">
                {group.tasks.map((t) => {
                  const isDone = t.status === OnboardingTaskStatus.DONE || t.status === OnboardingTaskStatus.SKIPPED;
                  return (
                    <li key={t.id} className="px-4 md:px-5 py-3 flex items-start gap-3 group hover:bg-surface-3/40 transition-colors">
                      <select
                        value={t.status}
                        onChange={(e) => updateStatus(t.id, e.target.value as OnboardingTaskStatus)}
                        className={cn(
                          "h-7 rounded-md border border-line bg-surface px-2 text-xs flex-shrink-0",
                          "hover:border-line-strong",
                          "focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
                        )}
                        aria-label={`Status of ${t.title}`}
                      >
                        {(Object.values(OnboardingTaskStatus) as OnboardingTaskStatus[]).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", isDone ? "line-through text-ink-faint" : "font-medium text-ink-strong")}>
                          {t.title}
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                          <span className="uppercase tracking-wide font-semibold text-ink">{PHASE_LABEL[t.phase]}</span>
                          {t.dueAt && <span> · due {format(new Date(t.dueAt), "PP")}</span>}
                          {t.owner ? (
                            <span> · assigned to <span className="text-ink-strong">{t.owner.name}</span></span>
                          ) : t.ownerRole ? (
                            <span> · unassigned · role: {ROLE_LABEL[t.ownerRole]}</span>
                          ) : null}
                        </p>
                        {t.description && <p className="text-xs text-ink-faint mt-1 leading-relaxed">{t.description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
