import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ClipboardCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { ListPage } from "@/components/templates";
import { EmptyState } from "@/components/help/EmptyState";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  AWAITING_VCIO_ACCEPT: "Awaiting accept",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
  DRAFT: "Draft",
};

const CLIENT_TYPE_LABEL: Record<string, string> = {
  IT: "IT",
  ACCESS_CONTROL: "Access Control",
  CCTV: "CCTV",
  MIXED: "Mixed",
};

export default async function SiteSurveyQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "site-survey:accept")) {
    redirect("/");
  }

  const [awaiting, accepted] = await Promise.all([
    prisma.siteSurvey.findMany({
      where: { status: "AWAITING_VCIO_ACCEPT" },
      orderBy: { scheduledDate: "asc" },
      include: {
        lead: {
          select: {
            id: true, businessName: true, industry: true, seatCount: true, siteCount: true,
            interestedServices: true, owner: { select: { name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.siteSurvey.findMany({
      where: { status: "ACCEPTED" },
      orderBy: { scheduledDate: "asc" },
      include: {
        lead: { select: { id: true, businessName: true, seatCount: true, siteCount: true } },
      },
      take: 20,
    }),
  ]);

  return (
    <ListPage
      title="Site survey queue"
      subtitle="Site surveys submitted by sales reps. Accept once the prep is solid (POC named, decision-maker confirmed, scope clear); reject with a reason so the rep can correct it before you walk on-site."
      crumbs={[{ label: "vCIO" }, { label: "Site surveys" }]}
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gtn-navy mb-3">Awaiting acceptance ({awaiting.length})</h2>
          {awaiting.length === 0 ? (
            <EmptyState
              Icon={ClipboardCheck}
              title="Inbox zero"
              body="No site surveys are waiting on you. New ones appear here when a rep submits one from a lead."
            />
          ) : (
            <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="ui-label text-left px-4 py-2.5">Lead</th>
                    <th className="ui-label text-left px-4 py-2.5">Client type</th>
                    <th className="ui-label text-left px-4 py-2.5">Scheduled</th>
                    <th className="ui-label text-left px-4 py-2.5">POC</th>
                    <th className="ui-label text-left px-4 py-2.5">Submitted by</th>
                    <th className="ui-label text-left px-4 py-2.5">Submitted</th>
                    <th className="ui-label text-left px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {awaiting.map((s) => (
                    <tr key={s.id} className="border-t border-line-subtle">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-gtn-navy hover:underline" href={`/leads/${s.lead.id}`}>
                          {s.lead.businessName}
                        </Link>
                        <p className="text-[11px] text-ink-faint">
                          {String(s.lead.industry).replace(/_/g, " ").toLowerCase()} · {s.lead.seatCount ?? "?"} seats · {s.lead.siteCount} site(s)
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm">{CLIENT_TYPE_LABEL[s.clientType] ?? s.clientType}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(s.scheduledDate).toLocaleDateString()}<br />
                        <span className="text-[11px] text-ink-faint">{s.scheduledStart}–{s.scheduledEnd} · {s.timezone}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {s.pocName}<br />
                        <span className="text-[11px] text-ink-faint">{s.pocTitle}</span>
                        {!s.pocCanAuthorize && (
                          <span className="block text-[11px] text-red-700">POC authority not confirmed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{s.createdBy.name}</td>
                      <td className="px-4 py-3 text-sm">{formatDistanceToNow(s.createdAt, { addSuffix: true })}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Link
                          href={`/leads/${s.lead.id}?tab=site-survey`}
                          className="text-gtn-navy hover:underline font-medium"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {accepted.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gtn-navy mb-3">Accepted & upcoming ({accepted.length})</h2>
            <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="ui-label text-left px-4 py-2.5">Lead</th>
                    <th className="ui-label text-left px-4 py-2.5">Scheduled</th>
                    <th className="ui-label text-left px-4 py-2.5">Status</th>
                    <th className="ui-label text-left px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {accepted.map((s) => (
                    <tr key={s.id} className="border-t border-line-subtle">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-gtn-navy hover:underline" href={`/leads/${s.lead.id}`}>
                          {s.lead.businessName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(s.scheduledDate).toLocaleDateString()} · {s.scheduledStart}
                      </td>
                      <td className="px-4 py-3 text-sm">{STATUS_LABEL[s.status]}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Link href={`/leads/${s.lead.id}?tab=site-survey`} className="text-gtn-navy hover:underline font-medium">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </ListPage>
  );
}
