import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { ListPage } from "@/components/templates";
import { TerritoriesList } from "./TerritoriesList";

export default async function SalesTerritoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");

  const sp = await searchParams;
  const teamFilter = sp.teamId;

  const [territories, teams] = await Promise.all([
    prisma.salesTerritory.findMany({
      where: teamFilter ? { teamId: teamFilter } : {},
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.salesTeam.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (teams.length === 0) {
    return (
      <ListPage
        title="Territories"
        crumbs={[{ href: "/sales", label: "Sales hub" }, { label: "Territories" }]}
      >
        <p className="text-sm text-ink-muted">
          Territories belong to teams.{" "}
          <Link href="/sales/teams" className="text-gtn-purple hover:underline font-medium">Create a team first →</Link>
        </p>
      </ListPage>
    );
  }

  return (
    <ListPage
      title="Territories"
      subtitle="Hybrid coverage: by state, zip code, city, AND/OR a drawn polygon. Any match assigns the lead."
      crumbs={[{ href: "/sales", label: "Sales hub" }, { label: "Territories" }]}
    >
      <TerritoriesList
        initialTerritories={territories.map((t) => ({
          id: t.id,
          name: t.name,
          teamId: t.teamId,
          teamName: t.team.name,
          stateCount: t.states.length,
          zipCount: t.zipCodes.length,
          cityCount: Array.isArray(t.cities) ? (t.cities as unknown[]).length : 0,
          hasPolygon: Boolean(t.polygon),
          active: t.active,
        }))}
        teams={teams}
        defaultTeamId={teamFilter}
      />
    </ListPage>
  );
}
