import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, canSeeCustomer } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { PageHeaderBand } from "@/components/brand";
import { AccountTabs } from "./AccountTabs";
import { ArchiveButton } from "./ArchiveButton";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      lead: {
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
      accountManager: { select: { id: true, name: true, email: true } },
      discoveryAssessments: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      qbrs: { orderBy: { scheduledAt: "desc" }, take: 50 },
    },
  });
  if (!customer) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, customer.lead.ownerUserId)) {
    return (
      <Card>
        <p className="text-sm text-gtn-grey-2">You don&apos;t have permission to view this account.</p>
      </Card>
    );
  }

  const lead = customer.lead;

  return (
    <div className="space-y-6">
      <PageHeaderBand pageTitle={`Account · ${lead.businessName}`} />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gtn-grey-3">
            <Link className="hover:underline" href={`/leads/${lead.id}`}>← back to original lead</Link>
          </p>
          <h1 className="text-2xl font-bold text-gtn-navy truncate mt-1">{lead.businessName}</h1>
          <div className="flex flex-wrap gap-2 mt-2 text-sm">
            <span className="inline-block rounded-full bg-gtn-purple text-white text-xs px-3 py-1">
              {customer.currentPhase.replace(/_/g, " ")}
            </span>
            <StatusBadge status={customer.status} />
            <span className="text-gtn-grey-2">{lead.industry.replace(/_/g, " ")}</span>
            {lead.seatCount && <span className="text-gtn-grey-2">· {lead.seatCount} seats</span>}
          </div>
        </div>
        {can(session.user.role, "customer:archive") && (
          <ArchiveButton
            customerId={customer.id}
            customerName={lead.businessName}
            alreadyArchived={Boolean(customer.archivedAt)}
          />
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatTile label="Account manager" value={customer.accountManager?.name ?? "Unassigned"} />
        <StatTile
          label="Onboarding started"
          value={customer.onboardingStartedAt ? format(new Date(customer.onboardingStartedAt), "PPP") : "—"}
        />
        <StatTile
          label="Next QBR"
          value={customer.nextQbrAt ? format(new Date(customer.nextQbrAt), "PPP") : "After onboarding"}
        />
        <StatTile
          label="Discovery"
          value={`${customer.discoveryAssessments.filter((d) => d.status === "COMPLETED").length}/${customer.discoveryAssessments.length} done`}
        />
      </div>

      <AccountTabs
        customerId={customer.id}
        currentPhase={customer.currentPhase}
        leadOwnerEmail={lead.owner.email}
        discoveryAssessments={customer.discoveryAssessments.map((d) => ({
          id: d.id,
          kind: d.kind,
          status: d.status,
          startedAt: d.startedAt?.toISOString() ?? null,
          completedAt: d.completedAt?.toISOString() ?? null,
          createdByName: d.createdBy.name,
        }))}
        qbrs={customer.qbrs.map((q) => ({
          id: q.id,
          scheduledAt: q.scheduledAt.toISOString(),
          completedAt: q.completedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="gtn-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-gtn-grey-2">{label}</p>
      <p className="text-sm font-medium text-gtn-navy mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ACTIVE" ? "bg-gtn-green-bg text-gtn-green"
      : status === "ONBOARDING" ? "bg-[#FEF3E2] text-gtn-amber"
      : status === "PAUSED" ? "bg-gtn-lavender text-gtn-grey-2"
      : "bg-[#FBE9E7] text-gtn-red";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {status}
    </span>
  );
}
