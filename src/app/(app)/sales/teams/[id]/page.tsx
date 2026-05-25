import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { DetailPage } from "@/components/templates";
import { TeamEditor } from "./TeamEditor";

export default async function SalesTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");
  const { id } = await params;

  const team = await prisma.salesTeam.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
        orderBy: [{ isPrimary: "desc" }, { joinedAt: "asc" }],
      },
      territories: { orderBy: { name: "asc" }, select: { id: true, name: true, states: true, zipCodes: true, cities: true, active: true } },
      _count: { select: { leads: true } },
    },
  });
  if (!team) notFound();

  const availableReps = await prisma.user.findMany({
    where: { active: true, role: Role.SALESPERSON },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <DetailPage
      crumbs={[
        { href: "/sales", label: "Sales hub" },
        { href: "/sales/teams", label: "Teams" },
        { label: team.name },
      ]}
      eyebrow="Sales team"
      title={team.name}
      subtitle={team.description}
      badges={
        <>
          <Badge tone={team.active ? "success" : "neutral"} shape="pill" size="sm" dot>
            {team.active ? "active" : "inactive"}
          </Badge>
          <Badge tone="brand" shape="pill" size="xs">{team._count.leads} leads</Badge>
        </>
      }
    >
      <TeamEditor
        team={{
          id: team.id,
          name: team.name,
          description: team.description,
          serviceLines: team.serviceLines,
          active: team.active,
        }}
        members={team.members.map((m) => ({
          id: m.id,
          userId: m.userId,
          isPrimary: m.isPrimary,
          role: m.role,
          user: m.user,
        }))}
        territories={team.territories.map((t) => ({
          id: t.id,
          name: t.name,
          states: t.states,
          zipCount: t.zipCodes.length,
          cityCount: Array.isArray(t.cities) ? t.cities.length : 0,
          active: t.active,
        }))}
        leadCount={team._count.leads}
        availableReps={availableReps}
      />
    </DetailPage>
  );
}
