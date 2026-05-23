"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { OnboardingPhase, OnboardingTaskStatus, Role } from "@prisma/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-gtn-grey-2">Role lens:</span>
            <select
              value={lens}
              onChange={(e) => setUrlParam("role", e.target.value === userRole ? null : e.target.value)}
              disabled={userRole !== Role.SUPERADMIN && lens !== userRole}
              className="h-8 rounded border border-input bg-white px-2 text-sm"
              title={userRole === Role.SUPERADMIN ? "Lens into any role" : "Locked to your role"}
            >
              {(Object.values(Role) as Role[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
            {userRole !== Role.SUPERADMIN && (
              <span className="text-[10px] text-gtn-grey-2">
                (Superadmins can lens into any role)
              </span>
            )}
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={includeDone}
                onChange={(e) => setUrlParam("includeDone", e.target.checked ? "true" : null)}
              />
              Include DONE / SKIPPED
            </label>
          </div>
          <div className="text-xs text-gtn-grey-2">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · {grouped.length} customer{grouped.length === 1 ? "" : "s"}
          </div>
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card>
          <p className="text-sm text-gtn-grey-2">
            {includeDone ? "No tasks at all yet." : "Nothing on your plate. Either you're caught up or no work has rolled out to your role yet."}
          </p>
        </Card>
      ) : (
        grouped.map((group) => {
          const openIds = group.tasks
            .filter((t) => t.status !== OnboardingTaskStatus.DONE && t.status !== OnboardingTaskStatus.SKIPPED)
            .map((t) => t.id);
          return (
            <Card key={group.customerId}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-gtn-navy">
                  <Link href={`/accounts/${group.customerId}`} className="hover:underline">
                    {group.customerName}
                  </Link>
                  <span className="text-gtn-grey-2 font-normal ml-2">({group.tasks.length})</span>
                </h2>
                {openIds.length > 0 && (
                  <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => bulkMarkDone(openIds)}>
                    Mark all {openIds.length} done
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-gtn-lavender-2">
                {group.tasks.map((t) => (
                  <li key={t.id} className="py-2 flex items-start gap-3">
                    <select
                      value={t.status}
                      onChange={(e) => updateStatus(t.id, e.target.value as OnboardingTaskStatus)}
                      className="h-7 rounded border border-input bg-white px-2 text-xs"
                      aria-label={`Status of ${t.title}`}
                    >
                      {(Object.values(OnboardingTaskStatus) as OnboardingTaskStatus[]).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="flex-1 min-w-0">
                      <p
                        className={
                          t.status === OnboardingTaskStatus.DONE || t.status === OnboardingTaskStatus.SKIPPED
                            ? "text-sm line-through text-gtn-grey-2"
                            : "text-sm font-medium text-gtn-navy"
                        }
                      >
                        {t.title}
                      </p>
                      <p className="text-[11px] text-gtn-grey-2 mt-0.5">
                        <span className="uppercase tracking-wide font-semibold">{PHASE_LABEL[t.phase]}</span>
                        {t.dueAt && <span> · due {format(new Date(t.dueAt), "PP")}</span>}
                        {t.owner ? (
                          <span> · assigned to {t.owner.name}</span>
                        ) : t.ownerRole ? (
                          <span> · unassigned · role: {ROLE_LABEL[t.ownerRole]}</span>
                        ) : null}
                      </p>
                      {t.description && <p className="text-[11px] text-gtn-grey-3 mt-0.5">{t.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </>
  );
}
