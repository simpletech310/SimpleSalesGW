import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Link href="/sales" className="text-xs text-gtn-purple hover:underline">← Sales</Link>
          <h1 className="text-2xl font-bold text-gtn-navy mt-1">Sales teams</h1>
          <p className="text-sm text-gtn-grey-2 mt-1">
            Group reps by service focus. Lead routing matches services against territory.
          </p>
        </div>
      </div>

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

      {teams.length === 0 && (
        <Card>
          <p className="text-sm text-gtn-grey-2 italic">
            No teams yet. Create your first team above to start routing leads.
          </p>
          <div className="mt-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/sales">← back</Link>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
