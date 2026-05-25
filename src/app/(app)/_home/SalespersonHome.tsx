import Link from "next/link";
import { Inbox, Users, Target, TrendingUp, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { EmptyState } from "@/components/help/EmptyState";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { leadVisibilityFilter } from "@/lib/rbac";
import { PipelineStage, type Role } from "@prisma/client";

/**
 * v3.0 — SalespersonHome on the unified DashboardPage template.
 *
 * Used by SALESPERSON (own leads only), SALES_MANAGER (team-wide via the
 * shared visibility filter), and SUPERADMIN (everything). The
 * `leadVisibilityFilter` helper scopes the same query for all three.
 *
 * Replaces the v2.x HeroBand with a refined header + 4-KPI strip + the
 * existing PipelineBoard wrapped in a DashboardSection.
 */
export async function SalespersonHome({
  user,
}: {
  user: { id: string; name: string | null; role: Role };
}) {
  const leads = await prisma.lead.findMany({
    where: leadVisibilityFilter(user.role, user.id),
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
  const lateStage = leads.filter(
    (l) => l.pipelineStage === PipelineStage.PROPOSAL || l.pipelineStage === PipelineStage.NEGOTIATION,
  );
  const closedWon = leads.filter((l) => l.pipelineStage === PipelineStage.CLOSED_WON).length;
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <DashboardPage
      eyebrow="Sales dashboard"
      title={`Welcome back, ${firstName}`}
      subtitle="Your pipeline at a glance — add a lead with the button on the right, or jump into one below."
      actions={
        <Button asChild size="sm">
          <Link href="/leads/new" className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            New lead
          </Link>
        </Button>
      }
      kpis={
        <>
          <StatCard label="All leads"      value={leads.length}    icon={Users}      tone="brand"   href="/leads" />
          <StatCard label="Active"         value={active.length}   icon={Target}     tone="brand"   href="/pipeline" />
          <StatCard label="Late stage"     value={lateStage.length} icon={TrendingUp} tone="warn"   href="/pipeline" />
          <StatCard label="Closed won"     value={closedWon}        icon={Inbox}     tone="success" />
        </>
      }
    >
      {leads.length === 0 ? (
        <DashboardSection>
          <EmptyState
            Icon={Inbox}
            title="No leads yet"
            body="Add your first lead and the portal scores it the moment you save. From there you'll see the deal-quality, services-fit and customer-fit scores update as you fill in more info."
            cta={{ label: "Add a lead", href: "/leads/new" }}
            secondaryCta={{ label: "Open help center", href: "/help" }}
          />
        </DashboardSection>
      ) : (
        <DashboardSection
          title="Pipeline"
          subtitle="Drag a lead between stages or click into one to keep working."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link href="/pipeline">Open full board →</Link>
            </Button>
          }
          flush
        >
          <div className="p-4 md:p-5">
            <PipelineBoard leads={leads} />
          </div>
        </DashboardSection>
      )}
    </DashboardPage>
  );
}
