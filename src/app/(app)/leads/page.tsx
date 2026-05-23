import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadVisibilityFilter } from "@/lib/rbac";
import { STRINGS } from "@/lib/strings";
import { Button } from "@/components/ui/Button";
import { scoreBadgeClass, formatScore } from "@/lib/utils";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const exportAllowed = can(session.user.role, "data:export");

  const leads = await prisma.lead.findMany({
    where: leadVisibilityFilter(session.user.role, session.user.id),
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gtn-navy">Leads</h1>
          <p className="text-sm text-gtn-grey-2">{leads.length} total</p>
        </div>
        <div className="flex gap-2">
          {exportAllowed && (
            <Button asChild variant="secondary">
              <a href="/api/export/leads.csv" download>Export CSV</a>
            </Button>
          )}
          {can(session.user.role, "lead:create") && (
            <Button asChild>
              <Link href="/leads/new">+ New Lead</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="gtn-card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3 hidden md:table-cell">Industry</th>
              <th className="px-4 py-3 hidden md:table-cell">Stage</th>
              <th className="px-4 py-3 text-right">DQ</th>
              <th className="px-4 py-3 hidden lg:table-cell">Owner</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t border-gtn-lavender-2 hover:bg-gtn-lavender/40">
                <td className="px-4 py-3">
                  <Link href={`/leads/${l.id}`} className="text-gtn-navy font-medium hover:underline">
                    {l.businessName}
                  </Link>
                  {l.nonStrategicFlag && (
                    <span className="ml-2 text-[10px] uppercase font-semibold text-gtn-red">Non-strategic</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gtn-grey-2">
                  {l.industry.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="gtn-stage-chip">{STRINGS.pipeline.stages[l.pipelineStage]}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={scoreBadgeClass(l.dealQualityScore)}>
                    {formatScore(l.dealQualityScore)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-gtn-grey-2">{l.owner.name}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gtn-grey-2">No leads yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
