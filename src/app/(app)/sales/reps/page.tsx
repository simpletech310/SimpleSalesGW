import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/components/templates";
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
        select: { isPrimary: true, team: { select: { id: true, name: true, active: true } } },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <ListPage
      title="Sales reps"
      subtitle="Hire new reps + see existing ones. Manage team membership from each team's page."
      crumbs={[{ href: "/sales", label: "Sales hub" }, { label: "Reps" }]}
    >
      <RepsList
        initialReps={reps.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          active: r.active,
          lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
          leadCount: r._count.ownedLeads,
          teamCount: r._count.teamMemberships,
          teamNames: r.teamMemberships
            .filter((m) => m.team.active)
            .map((m) => ({ id: m.team.id, name: m.team.name, isPrimary: m.isPrimary })),
        }))}
      />
    </ListPage>
  );
}
