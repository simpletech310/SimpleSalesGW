import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { loadNotifications } from "@/lib/notifications";
import { ListPage } from "@/components/templates";
import { DashboardSection } from "@/components/templates/DashboardPage";
import { HandoffRows, PricingApprovalRows } from "./NotificationsClient";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
    <ListPage
      title="Notifications"
      subtitle={`${data.total} item${data.total === 1 ? "" : "s"} waiting on you.`}
      toolbar={
        data.total > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {filterChips
              .filter((c) => c.key === "all" || c.count > 0)
              .map((c) => {
                const active = c.key === filter;
                return (
                  <Link
                    key={c.key}
                    href={c.key === "all" ? "/notifications" : `/notifications?filter=${c.key}`}
                    data-tap-target
                    className={cn(
                      "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium transition-colors",
                      active
                        ? "bg-gtn-navy text-white"
                        : "bg-surface text-ink border border-line hover:bg-surface-3 hover:text-ink-strong",
                    )}
                  >
                    {c.label}
                    <span className={cn("ml-1 tabular font-semibold", active ? "text-white/85" : "text-ink-muted")}>{c.count}</span>
                  </Link>
                );
              })}
          </div>
        ) : null
      }
      body={
        <div className="space-y-4 max-w-4xl">
          {show("actions") && (
            <Section title="Next actions due (next 7 days)" empty="Inbox zero — nothing scheduled.">
              {data.openActions.map((a) => (
                <Row key={a.activityId} href={`/leads/${a.leadId}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong">{a.nextAction}</p>
                    <p className="text-xs text-ink-muted">
                      {a.leadName}
                      {a.actorName && <span className="text-ink-faint"> · {a.actorName}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap tabular">{format(new Date(a.dueAt), "PPp")}</span>
                </Row>
              ))}
            </Section>
          )}

          {show("assessments") && (
            <Section title="Assessments awaiting completion" empty="No outstanding assessment links.">
              {data.assessmentsAwaiting.map((a) => (
                <Row key={a.id} href={`/leads/${a.leadId}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong">{a.leadName}</p>
                    <p className="text-xs text-ink-muted">{a.respondentEmail ?? "(no email captured)"}</p>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap tabular">sent {format(new Date(a.sentAt), "PPp")}</span>
                </Row>
              ))}
            </Section>
          )}

          {show("approvals") && (
            <Section title="Pricing approvals waiting on you" empty="No pricing approvals waiting.">
              <PricingApprovalRows rows={data.pricingApprovalsPending} role={session.user.role} />
            </Section>
          )}

          {show("handoffs") && (
            <Section title="Handoffs to accept" empty="No handoffs waiting.">
              <HandoffRows rows={data.handoffsAwaiting} role={session.user.role} />
            </Section>
          )}

          {show("onboarding") && (
            <Section title="Overdue onboarding tasks" empty="No overdue onboarding tasks.">
              {data.overdueOnboarding.map((t) => (
                <Row key={t.taskId} href={`/accounts/${t.customerId}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong">{t.title}</p>
                    <p className="text-xs text-ink-muted">{t.customerName} · {t.phase.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-xs text-danger whitespace-nowrap font-semibold">due {format(new Date(t.dueAt), "PP")}</span>
                </Row>
              ))}
            </Section>
          )}

          {show("qbrs") && (
            <Section title="Upcoming QBRs (next 30 days)" empty="No QBRs scheduled in the next 30 days.">
              {data.upcomingQbrs.map((q) => (
                <Row key={q.id} href={`/accounts/${q.customerId}/qbrs/${q.id}`}>
                  <p className="text-sm font-medium text-ink-strong">{q.customerName}</p>
                  <span className="text-xs text-ink-faint whitespace-nowrap tabular">{format(new Date(q.scheduledAt), "PPp")}</span>
                </Row>
              ))}
            </Section>
          )}

          {show("discovery") && (
            <Section title="Discovery assessments in progress" empty="No active discovery assessments.">
              {data.inProgressDiscovery.map((d) => (
                <Row key={d.id} href={`/accounts/${d.customerId}/discovery/${d.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong">{d.customerName}</p>
                    <p className="text-xs text-ink-muted">{d.kind.replace(/_/g, " ")}</p>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap tabular">started {format(new Date(d.startedAt), "PP")}</span>
                </Row>
              ))}
            </Section>
          )}

          {show("presale") && (
            <Section title="Pre-sale scoping requests" empty="No pre-sale scoping requests waiting.">
              {data.preSaleAssessments.map((p) => (
                <Row key={p.id} href={`/leads/${p.leadId}/discovery/${p.id}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-strong">{p.leadName}</p>
                    <p className="text-xs text-ink-muted">
                      {p.kind.replace(/_/g, " ")} · requested by {p.requestedByName}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint whitespace-nowrap tabular">
                    {p.status === "NOT_STARTED" ? "awaiting start" : "in progress"} · {format(new Date(p.requestedAt), "PP")}
                  </span>
                </Row>
              ))}
            </Section>
          )}
        </div>
      }
    />
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <DashboardSection title={title} flush>
      {hasChildren ? <div className="divide-y divide-line-subtle">{children}</div> : <p className="px-4 md:px-5 py-6 text-sm text-ink-muted text-center">{empty}</p>}
    </DashboardSection>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 hover:bg-surface-3/60 transition-colors">
      {children}
    </Link>
  );
}
