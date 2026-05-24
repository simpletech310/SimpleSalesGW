import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { loadNotifications } from "@/lib/notifications";
import { HandoffRows, PricingApprovalRows } from "./NotificationsClient";

export const dynamic = "force-dynamic";

// v2.14 — server-side filter so URLs are bookmarkable and deep-linkable
// (e.g. /notifications?filter=handoffs). Keeps the page a pure SSR
// component without forcing a client-state rewrite.
// v2.17 — added "presale" filter chip for pre-sale scoping requests.
type FilterKey = "all" | "actions" | "assessments" | "approvals" | "handoffs" | "onboarding" | "qbrs" | "discovery" | "presale";
const VALID_FILTERS: FilterKey[] = ["all", "actions", "assessments", "approvals", "handoffs", "onboarding", "qbrs", "discovery", "presale"];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const data = await loadNotifications({ id: session.user.id, role: session.user.role });
  const params = await searchParams;
  const filter: FilterKey = VALID_FILTERS.includes(params.filter as FilterKey)
    ? (params.filter as FilterKey)
    : "all";
  const show = (key: FilterKey) => filter === "all" || filter === key;

  const filterChips: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: data.total },
    { key: "actions", label: "Actions", count: data.openActions.length },
    { key: "approvals", label: "Approvals", count: data.pricingApprovalsPending.length },
    { key: "handoffs", label: "Handoffs", count: data.handoffsAwaiting.length },
    { key: "onboarding", label: "Onboarding", count: data.overdueOnboarding.length },
    { key: "qbrs", label: "QBRs", count: data.upcomingQbrs.length },
    { key: "presale", label: "Pre-sale scoping", count: data.preSaleAssessments.length },
    { key: "discovery", label: "Discovery", count: data.inProgressDiscovery.length },
    { key: "assessments", label: "Assessments", count: data.assessmentsAwaiting.length },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Notifications</h1>
        <p className="text-sm text-gtn-grey-2">{data.total} item{data.total === 1 ? "" : "s"} waiting on you.</p>
      </div>

      {/* v2.14 — filter chips. Clicking a chip narrows the page to one
          section so a busy COO can hyperfocus on handoffs or approvals
          without scrolling past the rest. */}
      {data.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterChips
            .filter((c) => c.key === "all" || c.count > 0)
            .map((c) => {
              const active = c.key === filter;
              return (
                <Link
                  key={c.key}
                  href={c.key === "all" ? "/notifications" : `/notifications?filter=${c.key}`}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-gtn-navy text-white"
                      : "bg-gtn-lavender text-gtn-navy hover:bg-gtn-lavender-2"
                  }`}
                >
                  {c.label}
                  <span className={`font-mono ${active ? "text-white/90" : "text-gtn-purple"}`}>{c.count}</span>
                </Link>
              );
            })}
        </div>
      )}

      {show("actions") && (
      <Section title="Next actions due (next 7 days)" empty="Inbox zero — nothing scheduled.">
        {data.openActions.map((a) => (
          <Link key={a.activityId} href={`/leads/${a.leadId}`} className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{a.nextAction}</p>
                <p className="text-xs text-gtn-grey-2">
                  {a.leadName}
                  {a.actorName && <span className="text-gtn-grey-3"> · {a.actorName}</span>}
                </p>
              </div>
              <span className="text-xs text-gtn-grey-3 whitespace-nowrap">{format(new Date(a.dueAt), "PPp")}</span>
            </div>
          </Link>
        ))}
      </Section>
      )}

      {show("assessments") && (
      <Section title="Assessments awaiting completion" empty="No outstanding assessment links.">
        {data.assessmentsAwaiting.map((a) => (
          <Link key={a.id} href={`/leads/${a.leadId}`} className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{a.leadName}</p>
                <p className="text-xs text-gtn-grey-2">{a.respondentEmail ?? "(no email captured)"}</p>
              </div>
              <span className="text-xs text-gtn-grey-3 whitespace-nowrap">sent {format(new Date(a.sentAt), "PPp")}</span>
            </div>
          </Link>
        ))}
      </Section>
      )}

      {/* v2.6 — inline approve/reject; approval buttons gated by role */}
      {show("approvals") && (
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          Pricing approvals waiting on you
        </div>
        <PricingApprovalRows rows={data.pricingApprovalsPending} role={session.user.role} />
      </Card>
      )}

      {/* v2.6 — inline accept/reject for handoffs */}
      {show("handoffs") && (
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          Handoffs to accept
        </div>
        <HandoffRows rows={data.handoffsAwaiting} role={session.user.role} />
      </Card>
      )}

      {show("onboarding") && (
      <Section title="Overdue onboarding tasks" empty="No overdue onboarding tasks.">
        {data.overdueOnboarding.map((t) => (
          <Link key={t.taskId} href={`/accounts/${t.customerId}`} className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{t.title}</p>
                <p className="text-xs text-gtn-grey-2">{t.customerName} · {t.phase.replace(/_/g, " ")}</p>
              </div>
              <span className="text-xs text-gtn-red whitespace-nowrap">due {format(new Date(t.dueAt), "PP")}</span>
            </div>
          </Link>
        ))}
      </Section>
      )}

      {show("qbrs") && (
      <Section title="Upcoming QBRs (next 30 days)" empty="No QBRs scheduled in the next 30 days.">
        {data.upcomingQbrs.map((q) => (
          <Link key={q.id} href={`/accounts/${q.customerId}/qbrs/${q.id}`} className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gtn-navy">{q.customerName}</p>
              <span className="text-xs text-gtn-grey-3 whitespace-nowrap">{format(new Date(q.scheduledAt), "PPp")}</span>
            </div>
          </Link>
        ))}
      </Section>
      )}

      {show("discovery") && (
      <Section title="Discovery assessments in progress" empty="No active discovery assessments.">
        {data.inProgressDiscovery.map((d) => (
          <Link key={d.id} href={`/accounts/${d.customerId}/discovery/${d.id}`} className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{d.customerName}</p>
                <p className="text-xs text-gtn-grey-2">{d.kind.replace(/_/g, " ")}</p>
              </div>
              <span className="text-xs text-gtn-grey-3 whitespace-nowrap">started {format(new Date(d.startedAt), "PP")}</span>
            </div>
          </Link>
        ))}
      </Section>
      )}

      {/* v2.17 — Pre-sale scoping queue: vCIO gets pulled in by sales to
          size deals before they close. Lives on the Lead. */}
      {show("presale") && (
      <Section title="Pre-sale scoping requests" empty="No pre-sale scoping requests waiting.">
        {data.preSaleAssessments.map((p) => (
          <Link
            key={p.id}
            href={`/leads/${p.leadId}/discovery/${p.id}`}
            className="block px-4 py-3 hover:bg-gtn-lavender/40 border-t border-gtn-lavender-2 first:border-0"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gtn-navy">{p.leadName}</p>
                <p className="text-xs text-gtn-grey-2">
                  {p.kind.replace(/_/g, " ")} · requested by {p.requestedByName}
                </p>
              </div>
              <span className="text-xs text-gtn-grey-3 whitespace-nowrap">
                {p.status === "NOT_STARTED" ? "awaiting start" : "in progress"} · {format(new Date(p.requestedAt), "PP")}
              </span>
            </div>
          </Link>
        ))}
      </Section>
      )}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">{title}</div>
      {hasChildren ? <div>{children}</div> : <p className="px-4 py-6 text-sm text-gtn-grey-2 text-center">{empty}</p>}
    </Card>
  );
}
