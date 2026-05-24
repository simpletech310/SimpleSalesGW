import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { EmptyState } from "@/components/help/EmptyState";
import { HeroBand } from "@/components/brand";
import { STRINGS } from "@/lib/strings";
import { leadVisibilityFilter } from "@/lib/rbac";
import { PipelineStage, type Role } from "@prisma/client";
import { Inbox } from "lucide-react";

/**
 * SalespersonHome — the original "pipeline first" landing.
 *
 * Used by SALESPERSON (own leads only), SALES_MANAGER (team-wide via the
 * shared visibility filter), and SUPERADMIN (everything). The `leadVisibility`
 * helper does the scoping so the same render path works for all three.
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
  const firstName = user.name?.split(" ")[0] ?? "there";
  const closedWon = leads.filter((l) => l.pipelineStage === PipelineStage.CLOSED_WON).length;

  return (
    <div className="space-y-6">
      <HeroBand
        eyebrow="SALES DASHBOARD"
        title={`Welcome back, ${firstName}`}
        subtitle="Your pipeline at a glance. Use the +New button to add a lead, or jump straight into one below."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/leads">{STRINGS.nav.leads}</Link>
            </Button>
            <Button asChild>
              <Link href="/leads/new">+ New Lead</Link>
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-4 max-w-lg">
          <div>
            <p className="gtn-eyebrow">All leads</p>
            <p className="text-2xl font-bold text-white">{leads.length}</p>
          </div>
          <div>
            <p className="gtn-eyebrow">Active</p>
            <p className="text-2xl font-bold text-white">{active.length}</p>
          </div>
          <div>
            <p className="gtn-eyebrow">Closed won</p>
            <p className="text-2xl font-bold text-white">{closedWon}</p>
          </div>
        </div>
      </HeroBand>

      {leads.length === 0 ? (
        <EmptyState
          Icon={Inbox}
          title="No leads yet"
          body="Add your first lead and the portal scores it the moment you save. From there you'll see the deal-quality, services-fit and customer-fit scores update as you fill in more info."
          cta={{ label: "Add a lead", href: "/leads/new" }}
          secondaryCta={{ label: "Open help center", href: "/help" }}
        />
      ) : (
        <PipelineBoard leads={leads} />
      )}
    </div>
  );
}
