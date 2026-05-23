import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { STRINGS } from "@/lib/strings";
import { can } from "@/lib/rbac";
import { PipelineStage } from "@prisma/client";

export default async function HomePage() {
  const session = await auth();
  const role = session?.user?.role ?? null;
  const viewAll = can(role, "lead:view:all");

  const leads = await prisma.lead.findMany({
    where: viewAll ? {} : { ownerUserId: session!.user.id },
    orderBy: [{ pipelineStage: "asc" }, { dealQualityScore: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      businessName: true,
      industry: true,
      pipelineStage: true,
      dealQualityScore: true,
      servicesScore: true,
      customerScore: true,
      nonStrategicFlag: true,
      primaryContactName: true,
      seatCount: true,
      updatedAt: true,
    },
  });

  const activeStages: PipelineStage[] = [
    PipelineStage.LEAD,
    PipelineStage.QUALIFIED,
    PipelineStage.DISCOVERY,
    PipelineStage.PRE_SALES,
    PipelineStage.PROPOSAL,
    PipelineStage.NEGOTIATION,
  ];
  const active = leads.filter((l) => activeStages.includes(l.pipelineStage));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gtn-navy">Pipeline</h1>
          <p className="text-sm text-gtn-grey-2">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} · {active.length} active
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/leads">{STRINGS.nav.leads}</Link>
          </Button>
          <Button asChild>
            <Link href="/leads/new">+ New Lead</Link>
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-gtn-navy">No leads yet</h2>
          <p className="text-sm text-gtn-grey-2 mt-1">
            Create your first lead to start tracking the pipeline.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link href="/leads/new">+ Create lead</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <PipelineBoard leads={leads} />
      )}
    </div>
  );
}
