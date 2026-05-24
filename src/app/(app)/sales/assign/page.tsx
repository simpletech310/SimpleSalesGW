import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AssignWorkbench } from "./AssignWorkbench";

export default async function AssignLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "lead:assign")) redirect("/");

  const sp = await searchParams;
  const showAll = sp.all === "1";

  const [leads, teams, reps] = await Promise.all([
    prisma.lead.findMany({
      where: showAll ? {} : { teamId: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        businessName: true,
        industry: true,
        addressCity: true,
        addressState: true,
        addressZip: true,
        pipelineStage: true,
        dealQualityScore: true,
        teamId: true,
        team: { select: { name: true } },
        owner: { select: { id: true, name: true } },
      },
    }),
    prisma.salesTeam.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { active: true, role: Role.SALESPERSON },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/sales" className="text-xs text-gtn-purple hover:underline">← Sales</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">Assign leads</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          {showAll
            ? "All leads — assign or reassign to teams or specific reps."
            : `${leads.length} unassigned lead${leads.length === 1 ? "" : "s"}.`}{" "}
          <Link href={showAll ? "/sales/assign" : "/sales/assign?all=1"} className="text-gtn-purple underline">
            {showAll ? "show only unassigned" : "show all"}
          </Link>
        </p>
      </div>

      <AssignWorkbench
        initialLeads={leads.map((l) => ({
          id: l.id,
          businessName: l.businessName,
          industry: l.industry,
          city: l.addressCity,
          state: l.addressState,
          zip: l.addressZip,
          stage: l.pipelineStage,
          dq: l.dealQualityScore,
          teamId: l.teamId,
          teamName: l.team?.name ?? null,
          ownerName: l.owner.name,
        }))}
        teams={teams}
        reps={reps}
      />
    </div>
  );
}
