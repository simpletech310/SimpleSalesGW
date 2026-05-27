import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow, startOfMonth, subDays } from "date-fns";
import { PipelineStage, Role } from "@prisma/client";
import { Activity, Briefcase, CheckCircle2, Trophy, Users } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DetailPage } from "@/components/templates";
import { RepActions } from "./RepActions";

export const dynamic = "force-dynamic";

const STAGE_TONE: Record<PipelineStage, "brand" | "success" | "danger" | "neutral" | "warn"> = {
  LEAD: "brand",
  QUALIFIED: "brand",
  FIRST_INTERACTION: "brand",
  SITE_SURVEY_SCHEDULED: "brand",
  DISCOVERY: "brand",
  QUOTE_IN_PROGRESS: "warn",
  QUOTE_SENT: "warn",
  NEGOTIATION: "warn",
  CLOSED_WON: "success",
  CLOSED_LOST: "danger",
};

const OPEN_STAGES: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.FIRST_INTERACTION,
  PipelineStage.SITE_SURVEY_SCHEDULED,
  PipelineStage.DISCOVERY,
  PipelineStage.QUOTE_IN_PROGRESS,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
];

export default async function RepDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "sales-rep:create")) redirect("/");
  const { id } = await params;

  const rep = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      lastLoginAt: true,
      teamMemberships: {
        select: {
          isPrimary: true,
          role: true,
          joinedAt: true,
          team: { select: { id: true, name: true, active: true, serviceLines: true } },
        },
        orderBy: [{ isPrimary: "desc" }, { joinedAt: "asc" }],
      },
    },
  });
  if (!rep) notFound();
  if (rep.role !== Role.SALESPERSON) {
    redirect("/admin/users");
  }

  const [leads, recentActivities, mtdClosedWon, otherReps] = await Promise.all([
    prisma.lead.findMany({
      where: { ownerUserId: id },
      select: {
        id: true,
        businessName: true,
        pipelineStage: true,
        seatCount: true,
        industry: true,
        updatedAt: true,
        dealQualityScore: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.activity.findMany({
      where: { actorUserId: id, createdAt: { gte: subDays(new Date(), 14) } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lead: { select: { id: true, businessName: true } } },
    }),
    prisma.lead.count({
      where: {
        ownerUserId: id,
        pipelineStage: PipelineStage.CLOSED_WON,
        updatedAt: { gte: startOfMonth(new Date()) },
      },
    }),
    prisma.user.findMany({
      where: { role: Role.SALESPERSON, active: true, NOT: { id } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openCount = leads.filter((l) => OPEN_STAGES.includes(l.pipelineStage)).length;
  const goingStale = leads.filter((l) => {
    if (!OPEN_STAGES.includes(l.pipelineStage)) return false;
    return subDays(new Date(), 7) > new Date(l.updatedAt);
  }).length;

  return (
    <DetailPage
      crumbs={[
        { href: "/sales", label: "Sales hub" },
        { href: "/sales/reps", label: "Reps" },
        { label: rep.name },
      ]}
      eyebrow="Sales rep"
      title={rep.name}
      subtitle={
        <span className="font-mono text-xs">{rep.email}</span>
      }
      badges={
        <>
          <Badge tone={rep.active ? "success" : "danger"} shape="pill" size="sm" dot>
            {rep.active ? "Active" : "Deactivated"}
          </Badge>
          {rep.teamMemberships.length === 0 ? (
            <Badge tone="warn" shape="pill" size="xs">No team</Badge>
          ) : (
            <Badge tone="brand" shape="pill" size="xs">
              {rep.teamMemberships.length} team{rep.teamMemberships.length === 1 ? "" : "s"}
            </Badge>
          )}
        </>
      }
      actions={
        <RepActions
          repId={rep.id}
          repName={rep.name}
          active={rep.active}
          openLeadCount={openCount}
          otherReps={otherReps}
        />
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Open leads"
          value={openCount}
          sub={goingStale > 0 ? `${goingStale} going stale (7+ days)` : "All fresh"}
          icon={Briefcase}
          tone={goingStale > 0 ? "warn" : "brand"}
        />
        <StatCard
          label="Closed-won (MTD)"
          value={mtdClosedWon}
          sub="this calendar month"
          icon={Trophy}
          tone="success"
        />
        <StatCard
          label="Activity (14d)"
          value={recentActivities.length}
          sub="logged touches"
          icon={Activity}
          tone="brand"
        />
        <StatCard
          label="Last sign-in"
          value={rep.lastLoginAt ? formatDistanceToNow(new Date(rep.lastLoginAt), { addSuffix: true }) : "never"}
          sub={rep.lastLoginAt ? format(new Date(rep.lastLoginAt), "MMM d, yyyy") : "—"}
          icon={CheckCircle2}
          tone="neutral"
        />
      </div>

      {/* Teams */}
      <section className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-strong inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-gtn-purple" /> Team memberships
          </h2>
          <p className="text-[11px] text-ink-faint uppercase tracking-wide font-semibold">
            {rep.teamMemberships.filter((m) => m.team.active).length} active
          </p>
        </div>
        {rep.teamMemberships.length === 0 ? (
          <p className="text-sm text-ink-faint italic py-3">
            Not on any team yet. Add them from a{" "}
            <Link href="/sales/teams" className="text-gtn-purple hover:underline font-medium">team page</Link>{" "}
            so they start seeing routed leads.
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle -mx-2">
            {rep.teamMemberships.map((m) => (
              <li key={m.team.id} className="px-2 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/sales/teams/${m.team.id}`}
                    className="text-sm font-medium text-ink-strong hover:text-gtn-purple inline-flex items-center gap-1.5"
                  >
                    {m.isPrimary && (
                      <span className="text-gtn-amber text-xs" title="Primary team">★</span>
                    )}
                    {m.team.name}
                  </Link>
                  <p className="text-[11px] text-ink-faint mt-0.5">
                    {m.role.toLowerCase()} · joined {format(new Date(m.joinedAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!m.team.active && <Badge tone="muted" shape="pill" size="xs">inactive</Badge>}
                  {m.team.serviceLines.length === 0 ? (
                    <Badge tone="neutral" shape="pill" size="xs">generalist</Badge>
                  ) : (
                    <Badge tone="brand" shape="pill" size="xs">
                      {m.team.serviceLines.length} service line{m.team.serviceLines.length === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Leads */}
      <section className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-line-subtle flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-strong inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gtn-purple" /> Lead book
          </h2>
          <p className="text-[11px] text-ink-faint tabular">
            {leads.length === 100 ? "showing 100 most recent" : `${leads.length} total`}
          </p>
        </div>
        {leads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-faint italic text-center">
            No leads owned yet. Use <Link href="/sales/assign" className="text-gtn-purple hover:underline">Assign workbench</Link> to route some.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th className="ui-label text-left px-4 py-2.5">Lead</th>
                  <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Industry</th>
                  <th className="ui-label text-right px-4 py-2.5 hidden sm:table-cell">Seats</th>
                  <th className="ui-label text-right px-4 py-2.5 hidden sm:table-cell">Score</th>
                  <th className="ui-label text-left px-4 py-2.5">Stage</th>
                  <th className="ui-label text-left px-4 py-2.5 hidden md:table-cell">Updated</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-line-subtle hover:bg-surface-3/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${l.id}`} className="text-ink-strong hover:text-gtn-purple font-medium">
                        {l.businessName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-ink-muted capitalize">
                      {l.industry.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-ink-strong hidden sm:table-cell">
                      {l.seatCount ?? <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular text-ink-strong hidden sm:table-cell">
                      {l.dealQualityScore || <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={STAGE_TONE[l.pipelineStage]} shape="pill" size="xs">
                        {l.pipelineStage.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-ink-faint tabular">
                      {formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-line-subtle flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-strong inline-flex items-center gap-2">
            <Activity className="h-4 w-4 text-gtn-purple" /> Recent activity (14d)
          </h2>
          <p className="text-[11px] text-ink-faint tabular">{recentActivities.length} touches</p>
        </div>
        {recentActivities.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-faint italic text-center">
            No logged activity in the last 14 days.
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {recentActivities.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-sm flex items-start gap-3 hover:bg-surface-3/30 transition-colors">
                <Badge tone="muted" shape="chip" size="xs" className="flex-shrink-0 mt-0.5">
                  {a.type.toLowerCase()}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-ink-strong truncate">{a.subject}</p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    <Link href={`/leads/${a.lead.id}`} className="hover:text-gtn-purple font-medium">
                      {a.lead.businessName}
                    </Link>
                    <span className="text-ink-faint"> · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DetailPage>
  );
}
