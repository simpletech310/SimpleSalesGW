import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { DetailPage } from "@/components/templates";
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

  const cities = Array.isArray(territory.cities) ? (territory.cities as Array<{ city: string; state: string }>) : [];
  const polygon = territory.polygon as { type: "Polygon"; coordinates: number[][][] } | null;

  return (
    <DetailPage
      crumbs={[
        { href: "/sales", label: "Sales hub" },
        { href: "/sales/territories", label: "Territories" },
        { label: territory.name },
      ]}
      eyebrow="Territory"
      title={territory.name}
      subtitle={
        <>
          Team:{" "}
          <Link href={`/sales/teams/${territory.teamId}`} className="text-gtn-purple hover:underline font-medium">
            {territory.team.name}
          </Link>
        </>
      }
      badges={
        <Badge tone={territory.active ? "success" : "neutral"} shape="pill" size="sm" dot>
          {territory.active ? "active" : "inactive"}
        </Badge>
      }
    >
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
    </DetailPage>
  );
}
