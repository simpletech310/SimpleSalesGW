import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, canSeeCustomer } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { DetailPage } from "@/components/templates";
import { AccountTabs } from "./AccountTabs";
import { ArchiveButton } from "./ArchiveButton";
import { AccountManagerPicker } from "./AccountManagerPicker";

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
      <div className="rounded-xl bg-surface border border-line-subtle p-6 max-w-md">
        <p className="text-sm text-ink-muted">You don&apos;t have permission to view this account.</p>
      </div>
    );
  }

  const lead = customer.lead;
  const completedDiscoveries = customer.discoveryAssessments.filter((d) => d.status === "COMPLETED").length;

  return (
    <DetailPage
      crumbs={[
        { href: "/accounts", label: "Accounts" },
        { href: `/leads/${lead.id}`, label: "Original lead" },
        { label: lead.businessName },
      ]}
      eyebrow="Account"
      title={lead.businessName}
      subtitle={
        <>
          {lead.industry.replace(/_/g, " ").toLowerCase()}
          {lead.seatCount ? <> · {lead.seatCount} seats</> : null}
        </>
      }
      badges={
        <>
          <Badge tone="brand" shape="pill" size="sm">
            {customer.currentPhase.replace(/_/g, " ").toLowerCase()}
          </Badge>
          <StatusBadge status={customer.status} />
        </>
      }
      actions={
        can(session.user.role, "customer:archive") && (
          <ArchiveButton
            customerId={customer.id}
            customerName={lead.businessName}
            alreadyArchived={Boolean(customer.archivedAt)}
          />
        )
      }
    >
      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile
          label="Account manager"
          value={
            <AccountManagerPicker
              customerId={customer.id}
              currentManagerId={customer.accountManagerId}
              currentManagerName={customer.accountManager?.name ?? null}
              canEdit={can(session.user.role, "onboarding:manage")}
            />
          }
        />
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
          value={`${completedDiscoveries}/${customer.discoveryAssessments.length} done`}
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
    </DetailPage>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface border border-line-subtle p-3.5">
      <p className="ui-label">{label}</p>
      <div className="text-sm font-medium text-ink-strong mt-1.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE" ? "success" :
    status === "ONBOARDING" ? "warn" :
    status === "PAUSED" ? "neutral" :
    "danger";
  return <Badge tone={tone} shape="pill" size="xs">{status.toLowerCase()}</Badge>;
}
