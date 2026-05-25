import { redirect } from "next/navigation";
import { Users, MapPin, UserPlus, Inbox } from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardPage } from "@/components/templates";

/**
 * v3.0 — /sales hub for Sales Managers and Superadmins.
 *
 * Four-tile KPI grid wired into the rest of the sales-management
 * sub-routes: Teams · Territories · Reps · Assign workbench.
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
    <DashboardPage
      eyebrow="Sales management"
      title="Sales hub"
      subtitle="Create teams scoped by service, draw geographic territories, hire reps, and assign leads. Each lead the system imports auto-matches to a territory based on the address; you can override any assignment here."
      kpis={
        <>
          <StatCard
            label="Teams"
            value={teamCount}
            icon={Users}
            tone="brand"
            href="/sales/teams"
            sub="Active sales teams grouped by service"
          />
          <StatCard
            label="Territories"
            value={territoryCount}
            icon={MapPin}
            tone="brand"
            href="/sales/territories"
            sub="Geographic coverage — zip / city / state / polygon"
          />
          <StatCard
            label="Reps"
            value={repCount}
            icon={UserPlus}
            tone="brand"
            href="/sales/reps"
            sub="Active salespeople — manage team membership"
          />
          <StatCard
            label="Unassigned leads"
            value={unassignedCount}
            icon={Inbox}
            tone={unassignedCount > 0 ? "warn" : "success"}
            href="/sales/assign"
            sub="Leads waiting for a team"
          />
        </>
      }
    >
      {/* The KPI tiles double as navigation; the rest of the hub lives in sub-routes. */}
    </DashboardPage>
  );
}
