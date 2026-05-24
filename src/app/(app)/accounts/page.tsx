import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Briefcase } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { customerVisibilityFilter } from "@/lib/rbac";
import { EmptyState } from "@/components/help/EmptyState";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const customers = await prisma.customer.findMany({
    where: customerVisibilityFilter(session.user.role, session.user.id),
    include: {
      lead: { select: { id: true, businessName: true, industry: true } },
      accountManager: { select: { name: true } },
      // v2.14 — health needs done-vs-total task count + last completed QBR
      onboardingTasks: { select: { status: true } },
      qbrs: {
        orderBy: { scheduledAt: "desc" },
        take: 1,
        select: { scheduledAt: true, completedAt: true },
      },
      _count: { select: { onboardingTasks: true, qbrs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // v2.14 — derive a simple health signal per customer.
  // Green  = onboarding ≥80% OR a QBR has happened in the last 90 days
  // Amber  = onboarding 40–79% AND no recent QBR
  // Red    = onboarding <40% AND >30 days since creation, or no QBR for 120+ days
  type Health = "green" | "amber" | "red";
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  const ONE_TWENTY_DAYS = 120 * 24 * 60 * 60 * 1000;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const healthByCustomer = new Map<string, { dot: Health; onboardingPct: number; daysSinceQbr: number | null }>();
  for (const c of customers) {
    const total = c.onboardingTasks.length;
    const done = c.onboardingTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const lastQbr = c.qbrs[0]?.completedAt ?? null;
    const daysSinceQbr = lastQbr
      ? Math.floor((now - new Date(lastQbr).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    const ageMs = now - new Date(c.createdAt).getTime();
    let dot: Health = "amber";
    if (pct >= 80 || (lastQbr && now - new Date(lastQbr).getTime() < NINETY_DAYS)) {
      dot = "green";
    } else if ((pct < 40 && ageMs > THIRTY_DAYS) || (lastQbr && now - new Date(lastQbr).getTime() > ONE_TWENTY_DAYS)) {
      dot = "red";
    }
    healthByCustomer.set(c.id, { dot, onboardingPct: pct, daysSinceQbr });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Accounts</h1>
        <p className="text-sm text-gtn-grey-2">
          {customers.length} {customers.length === 1 ? "customer" : "customers"} · post-handoff lifecycle
        </p>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          Icon={Briefcase}
          title="No customers yet"
          body="An Account appears here the moment a Sales-to-Ops handoff is accepted. Once it does, the vCIO takes over Discovery, Inventory, QBRs, and the strategic roadmap."
          cta={{ label: "Open notifications", href: "/notifications" }}
          secondaryCta={{ label: "Open help center", href: "/help" }}
        />
      ) : (
        <div className="gtn-card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3 text-center" title="Customer health · green/amber/red">Health</th>
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Phase</th>
                <th className="px-4 py-3 hidden lg:table-cell">Account manager</th>
                <th className="px-4 py-3 text-right">Onboarding</th>
                <th className="px-4 py-3 hidden md:table-cell">Started</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const h = healthByCustomer.get(c.id);
                return (
                <tr key={c.id} className="border-t border-gtn-lavender-2 hover:bg-gtn-lavender/40">
                  <td className="px-4 py-3">
                    <Link href={`/accounts/${c.id}`} className="text-gtn-navy font-medium hover:underline">
                      {c.lead.businessName}
                    </Link>
                    <p className="text-xs text-gtn-grey-3">{c.lead.industry.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-4 py-3 text-center" title={
                    h ? `${h.onboardingPct}% onboarding · ${h.daysSinceQbr === null ? "no QBR yet" : `${h.daysSinceQbr}d since last QBR`}` : ""
                  }>
                    <HealthDot dot={h?.dot ?? "amber"} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">
                    <span className="inline-block rounded-full bg-gtn-lavender px-2 py-0.5 text-gtn-navy">
                      {c.currentPhase.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gtn-grey-2">
                    {c.accountManager?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gtn-grey-2">
                    {h?.onboardingPct ?? 0}% · {c._count.onboardingTasks} tasks
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gtn-grey-3">
                    {c.onboardingStartedAt ? format(new Date(c.onboardingStartedAt), "PPP") : "—"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* v2.14 — make the "where's the account I just closed?" failure mode
          discoverable. Customers only appear after a handoff is accepted. */}
      <p className="text-xs text-gtn-grey-2 mt-4">
        Looking for a customer that should be here? A Customer only appears
        after a Sales-to-Ops handoff has been accepted by the COO.{" "}
        <Link href="/leads" className="text-gtn-purple hover:underline">
          See your closed-won leads →
        </Link>
      </p>
    </div>
  );
}

function HealthDot({ dot }: { dot: "green" | "amber" | "red" }) {
  const cls =
    dot === "green" ? "bg-gtn-green" : dot === "red" ? "bg-gtn-red" : "bg-gtn-amber";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} aria-label={`Health: ${dot}`} />;
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
