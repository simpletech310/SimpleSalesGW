import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { loadNotifications } from "@/lib/notifications";
import { HandoffRows, PricingApprovalRows } from "./NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const data = await loadNotifications({ id: session.user.id, role: session.user.role });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Notifications</h1>
        <p className="text-sm text-gtn-grey-2">{data.total} item{data.total === 1 ? "" : "s"} waiting on you.</p>
      </div>

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

      {/* v2.6 — inline approve/reject; approval buttons gated by role */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          Pricing approvals waiting on you
        </div>
        <PricingApprovalRows rows={data.pricingApprovalsPending} role={session.user.role} />
      </Card>

      {/* v2.6 — inline accept/reject for handoffs */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gtn-lavender text-xs uppercase tracking-wide font-semibold text-gtn-navy">
          Handoffs to accept
        </div>
        <HandoffRows rows={data.handoffsAwaiting} role={session.user.role} />
      </Card>

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
