import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { TerritoryEditor } from "./TerritoryEditor";

export default async function TerritoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");
  const { id } = await params;

  const [territory, teams] = await Promise.all([
    prisma.salesTerritory.findUnique({
      where: { id },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.salesTeam.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!territory) notFound();

  // Coerce JSON values for the client
  const cities = Array.isArray(territory.cities) ? (territory.cities as Array<{ city: string; state: string }>) : [];
  const polygon = territory.polygon as { type: "Polygon"; coordinates: number[][][] } | null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales/territories" className="text-xs text-gtn-purple hover:underline">← Territories</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">{territory.name}</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          Team: <Link href={`/sales/teams/${territory.teamId}`} className="text-gtn-purple hover:underline">{territory.team.name}</Link>
        </p>
      </div>

      <TerritoryEditor
        territory={{
          id: territory.id,
          name: territory.name,
          teamId: territory.teamId,
          states: territory.states,
          zipCodes: territory.zipCodes,
          cities,
          polygon,
          active: territory.active,
        }}
        teams={teams}
      />
    </div>
  );
}
