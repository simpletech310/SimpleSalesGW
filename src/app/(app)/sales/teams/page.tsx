import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/components/templates";
import { TeamsList } from "./TeamsList";

export default async function SalesTeamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");

  const teams = await prisma.salesTeam.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { members: true, territories: true, leads: true } } },
  });

  return (
    <ListPage
      title="Sales teams"
      subtitle="Group reps by service focus. Lead routing matches services against territory."
      crumbs={[{ href: "/sales", label: "Sales hub" }, { label: "Teams" }]}
    >
      <TeamsList
        initialTeams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          serviceLines: t.serviceLines,
          active: t.active,
          memberCount: t._count.members,
          territoryCount: t._count.territories,
          leadCount: t._count.leads,
        }))}
      />
    </ListPage>
  );
}
