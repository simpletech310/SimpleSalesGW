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
      _count: { select: { onboardingTasks: true, qbrs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 hidden md:table-cell">Phase</th>
                <th className="px-4 py-3 hidden lg:table-cell">Account manager</th>
                <th className="px-4 py-3 text-right">Onboarding</th>
                <th className="px-4 py-3 hidden md:table-cell">Started</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-gtn-lavender-2 hover:bg-gtn-lavender/40">
                  <td className="px-4 py-3">
                    <Link href={`/accounts/${c.id}`} className="text-gtn-navy font-medium hover:underline">
                      {c.lead.businessName}
                    </Link>
                    <p className="text-xs text-gtn-grey-3">{c.lead.industry.replace(/_/g, " ")}</p>
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
                    {c._count.onboardingTasks} tasks
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gtn-grey-3">
                    {c.onboardingStartedAt ? format(new Date(c.onboardingStartedAt), "PPP") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
