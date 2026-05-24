import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { RepsList } from "./RepsList";

export default async function SalesRepsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "sales-rep:create")) redirect("/");

  const reps = await prisma.user.findMany({
    where: { role: Role.SALESPERSON },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      lastLoginAt: true,
      _count: { select: { ownedLeads: true, teamMemberships: true } },
      teamMemberships: {
        select: { isPrimary: true, team: { select: { name: true, active: true } } },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales" className="text-xs text-gtn-purple hover:underline">← Sales</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">Sales reps</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          Hire new reps + see existing ones. Manage team membership from each team&apos;s page.
        </p>
      </div>

      <RepsList
        initialReps={reps.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          active: r.active,
          lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
          leadCount: r._count.ownedLeads,
          teamCount: r._count.teamMemberships,
          teamNames: r.teamMemberships.filter((m) => m.team.active).map((m) => ({ name: m.team.name, isPrimary: m.isPrimary })),
        }))}
      />

      {reps.length === 0 && (
        <Card>
          <p className="text-sm text-gtn-grey-2 italic">No reps yet. Click &ldquo;+ New rep&rdquo; above to hire your first.</p>
        </Card>
      )}
    </div>
  );
}
