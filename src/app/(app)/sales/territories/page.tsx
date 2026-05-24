import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
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
      <div className="space-y-4">
        <div>
          <Link href="/sales" className="text-xs text-gtn-purple hover:underline">← Sales</Link>
          <h1 className="text-2xl font-bold text-gtn-navy mt-1">Territories</h1>
        </div>
        <Card>
          <p className="text-sm text-gtn-grey-2">
            Territories belong to teams. <Link href="/sales/teams" className="text-gtn-purple underline">Create a team first →</Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales" className="text-xs text-gtn-purple hover:underline">← Sales</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">Territories</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          Hybrid coverage: by state, zip code, city, AND/OR a drawn polygon. Any match assigns the lead.
        </p>
      </div>

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
    </div>
  );
}
