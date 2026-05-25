import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingTaskStatus, Role } from "@prisma/client";
import { MyTasksView } from "./MyTasksView";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ListPage } from "@/components/templates";

// Completing or reassigning a task must show up immediately on next page load.
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

  const printHref = `/my-tasks/print${lensRaw ? `?role=${lensRaw}` : ""}${includeDone ? `${lensRaw ? "&" : "?"}includeDone=true` : ""}`;

  return (
    <ListPage
      title="My tasks"
      subtitle="Onboarding work across every customer, role-filtered."
      actions={
        <Button asChild variant="secondary" size="sm">
          <a href={printHref} target="_blank" rel="noreferrer">Print checklist</a>
        </Button>
      }
      meta={
        tasks.length > 0 ? (
          <>
            <Badge tone="danger"  shape="pill" size="sm" dot>Overdue <span className="ml-1 tabular font-semibold">{overdueCount}</span></Badge>
            <Badge tone="warn"    shape="pill" size="sm" dot>This week <span className="ml-1 tabular font-semibold">{dueThisWeekCount}</span></Badge>
            <Badge tone="brand"   shape="pill" size="sm" dot>Next 14d <span className="ml-1 tabular font-semibold">{dueNext14Count}</span></Badge>
            <Badge tone="neutral" shape="pill" size="sm" dot>Later <span className="ml-1 tabular font-semibold">{laterCount}</span></Badge>
            {noDueCount > 0 && (
              <Badge tone="muted" shape="pill" size="sm">No due date <span className="ml-1 tabular font-semibold">{noDueCount}</span></Badge>
            )}
          </>
        ) : null
      }
      body={
        <div className="space-y-4">
          <MyTasksView
            initialTasks={tasks as never}
            userRole={session.user.role}
            lens={lens}
            includeDone={includeDone}
          />
        </div>
      }
    />
  );
}
