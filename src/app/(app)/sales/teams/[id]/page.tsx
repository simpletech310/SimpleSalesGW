import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
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

  // For the "add member" picker — list every active SALESPERSON in the org
  const availableReps = await prisma.user.findMany({
    where: { active: true, role: Role.SALESPERSON },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales/teams" className="text-xs text-gtn-purple hover:underline">← Sales teams</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">{team.name}</h1>
        {team.description && <p className="text-sm text-gtn-grey-2 mt-1">{team.description}</p>}
      </div>

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
    </div>
  );
}
