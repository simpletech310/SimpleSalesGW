import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingTaskStatus, Role } from "@prisma/client";
import { MyTasksView } from "./MyTasksView";

// v2.14 — completing or reassigning a task must show up immediately on
// next page load. Without this, a stale rendered page can re-display a
// completed task until cache TTL expires.
export const dynamic = "force-dynamic";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; includeDone?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const lensRaw = params.role;
  const includeDone = params.includeDone === "true";

  let lens: Role = session.user.role;
  if (lensRaw && (Object.values(Role) as string[]).includes(lensRaw)) {
    if (session.user.role === Role.SUPERADMIN) lens = lensRaw as Role;
  }

  // SSR initial fetch — direct DB query to avoid a roundtrip.
  const tasks = await prisma.onboardingTask.findMany({
    where: {
      ...(includeDone
        ? {}
        : { status: { notIn: [OnboardingTaskStatus.DONE, OnboardingTaskStatus.SKIPPED] } }),
      OR: [
        { ownerUserId: session.user.id },
        ...(lens === Role.SALESPERSON ? [] : [{ ownerRole: lens, ownerUserId: null }]),
      ],
    },
    orderBy: [{ dueAt: "asc" }, { phase: "asc" }, { position: "asc" }],
    include: {
      customer: { select: { id: true, lead: { select: { businessName: true } } } },
      owner: { select: { id: true, name: true } },
    },
  });

  // v2.14 — bucket counts for the focus chips above the list.
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
  let overdueCount = 0;
  let dueThisWeekCount = 0;
  let dueNext14Count = 0;
  let laterCount = 0;
  let noDueCount = 0;
  for (const t of tasks) {
    if (t.status === OnboardingTaskStatus.DONE || t.status === OnboardingTaskStatus.SKIPPED) continue;
    if (!t.dueAt) { noDueCount++; continue; }
    const due = new Date(t.dueAt).getTime();
    if (due < now) overdueCount++;
    else if (due < now + SEVEN_DAYS) dueThisWeekCount++;
    else if (due < now + FOURTEEN_DAYS) dueNext14Count++;
    else laterCount++;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gtn-navy">My tasks</h1>
          <p className="text-sm text-gtn-grey-2 mt-1">
            Onboarding work across every customer, role-filtered.
          </p>
        </div>
        <a
          href={`/my-tasks/print${lensRaw ? `?role=${lensRaw}` : ""}${includeDone ? `${lensRaw ? "&" : "?"}includeDone=true` : ""}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gtn-purple underline self-end"
        >
          Print my checklist →
        </a>
      </div>
      {/* v2.14 — at-a-glance focus chips. Tasks themselves stay in the
          MyTasksView list below; this just gives users an immediate read
          on what needs attention before they scan the table. */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip label="Overdue" count={overdueCount} tone="red" />
          <Chip label="Due this week" count={dueThisWeekCount} tone="amber" />
          <Chip label="Next 14 days" count={dueNext14Count} tone="purple" />
          <Chip label="Later" count={laterCount} tone="grey" />
          {noDueCount > 0 && <Chip label="No due date" count={noDueCount} tone="grey" />}
        </div>
      )}

      <MyTasksView
        initialTasks={tasks as never}
        userRole={session.user.role}
        lens={lens}
        includeDone={includeDone}
      />
    </div>
  );
}

function Chip({ label, count, tone }: { label: string; count: number; tone: "red" | "amber" | "purple" | "grey" }) {
  const cls =
    tone === "red"
      ? "bg-[#FBE9E7] text-gtn-red"
      : tone === "amber"
      ? "bg-[#FEF3E2] text-gtn-amber"
      : tone === "purple"
      ? "bg-gtn-lavender text-gtn-purple"
      : "bg-gtn-lavender-2 text-gtn-grey-2";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
      <span className="font-mono">{count}</span>
    </span>
  );
}
