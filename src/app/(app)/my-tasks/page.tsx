import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingTaskStatus, Role } from "@prisma/client";
import { MyTasksView } from "./MyTasksView";

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
      <MyTasksView
        initialTasks={tasks as never}
        userRole={session.user.role}
        lens={lens}
        includeDone={includeDone}
      />
    </div>
  );
}
