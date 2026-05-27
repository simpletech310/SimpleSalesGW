import { redirect } from "next/navigation";
import { PipelineStage } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { leadVisibilityFilter } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { DashboardPage } from "@/components/templates";

export const dynamic = "force-dynamic";

/**
 * v3.4 — Shared pipeline kanban for every role.
 *
 * Visibility is scoped server-side via leadVisibilityFilter:
 *   - SALESPERSON  → own leads + team-mate leads
 *   - SALES_MANAGER / COO / SUPERADMIN → all leads
 *   - VCIO         → leads from SITE_SURVEY_SCHEDULED onward
 *
 * The home dashboard shows a compact PipelineStrip; this is the full
 * drag-and-drop board.
 */
export default async function PipelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ stage?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sp = (await searchParams) ?? {};
  const stageFilter = sp.stage && Object.values(PipelineStage).includes(sp.stage as PipelineStage)
    ? (sp.stage as PipelineStage)
    : null;

  const teamIds = await userTeamIds(session.user.id);
  const visibility = leadVisibilityFilter(session.user.role, session.user.id, teamIds);

  const leads = await prisma.lead.findMany({
    where: stageFilter ? { ...visibility, pipelineStage: stageFilter } : visibility,
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

  return (
    <DashboardPage
      eyebrow="Pipeline"
      title="Sales pipeline"
      subtitle="Drag a lead between stages or click into one. The board is the same for every role — what you see depends on your visibility."
    >
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <PipelineBoard leads={leads} />
      </div>
    </DashboardPage>
  );
}
