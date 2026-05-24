import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, MapPin, UserPlus, Inbox } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";

/**
 * v2.22 — /sales — Sales Manager landing.
 *
 * Four-tile grid: Teams · Territories · Reps · Assign workbench.
 */
export default async function SalesHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "team:manage")) redirect("/");

  const [teamCount, territoryCount, repCount, unassignedCount] = await Promise.all([
    prisma.salesTeam.count({ where: { active: true } }),
    prisma.salesTerritory.count({ where: { active: true } }),
    prisma.user.count({ where: { active: true, role: "SALESPERSON" } }),
    prisma.lead.count({ where: { teamId: null } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Sales management</h1>
        <p className="text-sm text-gtn-grey-2 mt-1 max-w-3xl">
          Create teams scoped by service, draw geographic territories, hire reps,
          and assign leads. Each lead the system imports auto-matches to a
          territory based on the address; you can override any assignment here.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/sales/teams" className="block">
          <Card className="h-full">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-gtn-purple mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold">Teams</h2>
                <p className="text-2xl font-mono text-gtn-navy">{teamCount}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">Active sales teams grouped by service.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/sales/territories" className="block">
          <Card className="h-full">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gtn-purple mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold">Territories</h2>
                <p className="text-2xl font-mono text-gtn-navy">{territoryCount}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">Geographic coverage — zip / city / state / polygon.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/sales/reps" className="block">
          <Card className="h-full">
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-gtn-purple mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold">Reps</h2>
                <p className="text-2xl font-mono text-gtn-navy">{repCount}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">Active salespeople; manage team membership.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/sales/assign" className="block">
          <Card className="h-full">
            <div className="flex items-start gap-3">
              <Inbox className="h-5 w-5 text-gtn-amber mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold">Assign leads</h2>
                <p className="text-2xl font-mono text-gtn-navy">{unassignedCount}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">Unassigned leads waiting for a team.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
