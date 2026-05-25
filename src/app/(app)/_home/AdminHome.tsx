import Link from "next/link";
import { formatDistanceToNow, startOfMonth } from "date-fns";
import {
  Users as UsersIcon,
  Briefcase,
  Target,
  Sparkles,
  ScrollText,
  HeartPulse,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { DetailSplit } from "@/components/templates/DetailPage";
import { integrationHealth } from "@/lib/env";
import { spendForOrg } from "@/lib/ai/budget";
import { CustomerStatus, PipelineStage, Role, type Role as RoleType } from "@prisma/client";

/**
 * v3.1 — Superadmin dashboard.
 *
 * Distinct from a working dashboard — this is a system-health surface.
 * What the operator sees here is "is everything wired up, are people
 * using it, are we leaking money?"
 *
 * KPI strip: active users · active leads · active customers · MTD AI spend.
 * Main: integration health pill row + recent audit events.
 * Aside: AI usage snapshot + recent sign-ins.
 */
export async function AdminHome({
  user,
}: {
  user: { id: string; name: string | null; role: RoleType };
}) {
  const firstName = user.name?.split(" ")[0] ?? "Admin";
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [
    activeUsers,
    totalLeads,
    activeCustomers,
    spend,
    auditEvents,
    recentSignIns,
    aiByFeature,
  ] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count({
      where: { pipelineStage: { notIn: [PipelineStage.CLOSED_WON, PipelineStage.CLOSED_LOST] } },
    }),
    prisma.customer.count({
      where: { status: { in: [CustomerStatus.ONBOARDING, CustomerStatus.ACTIVE] } },
    }),
    spendForOrg(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { actor: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { active: true, lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
      take: 5,
    }),
    prisma.aiUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
      _sum: { estimatedCostUsd: true },
    }),
  ]);

  const health = integrationHealth();

  // Pretty up the AI feature rollup (top 5 by spend).
  const aiTop = aiByFeature
    .map((g) => ({
      feature: g.feature,
      calls: g._count._all,
      cost: Number(g._sum.estimatedCostUsd ?? 0),
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return (
    <DashboardPage
      eyebrow="System overview"
      title={`Welcome back, ${firstName}`}
      subtitle="Integration health, recent system activity, and what your team is spending on AI."
      actions={
        <Button asChild size="sm">
          <Link href="/admin">Admin tools →</Link>
        </Button>
      }
      kpis={
        <>
          <StatCard label="Active users"     value={activeUsers}   icon={UsersIcon} tone="brand"   href="/admin/users" />
          <StatCard label="Active leads"     value={totalLeads}    icon={Target}    tone="brand"   href="/leads" />
          <StatCard label="Active customers" value={activeCustomers} icon={Briefcase} tone="brand" href="/accounts" />
          <StatCard
            label="AI spend MTD"
            value={`$${spend.costUsdThisMonth.toFixed(2)}`}
            icon={Sparkles}
            tone={spend.costUsdThisMonth > 50 ? "warn" : "success"}
            href="/admin/ai-usage"
            sub={`${spend.callsThisMonth.toLocaleString()} calls this month`}
          />
        </>
      }
    >
      <DetailSplit
        asideWidth="340px"
        main={
          <>
            {/* Integration health */}
            <DashboardSection
              title="Integration health"
              subtitle="Configured vs degraded across every third-party we depend on."
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/setup">Run setup wizard →</Link>
                </Button>
              }
            >
              <div className="grid sm:grid-cols-2 gap-2.5">
                <HealthPill name="Database"     ok={health.database.configured}   ifOk="Connected" ifNot="DATABASE_URL missing" />
                <HealthPill name="Auth secret"  ok={health.authSecretStable}      ifOk="Stable"     ifNot="Ephemeral — sessions reset on deploy" />
                <HealthPill name="Email (Resend)" ok={health.resend.configured}   ifOk="Configured" ifNot="Magic-link + outreach disabled" />
                <HealthPill name="Anthropic"    ok={health.anthropic.configured}  ifOk="Configured" ifNot="Auto-summary disabled" />
                <HealthPill name="Blob storage" ok={health.blob.configured}       ifOk="Configured" ifNot="File uploads disabled" />
                <HealthPill name="Mapbox"       ok={health.mapbox.configured}     ifOk="Configured" ifNot="/leads/map degraded" />
                <HealthPill name="Daily.co"     ok={health.daily.configured}      ifOk="Configured" ifNot="Video/audio calls disabled" />
              </div>
            </DashboardSection>

            {/* Recent audit events */}
            <DashboardSection
              title="Recent audit events"
              subtitle="Last 10 state changes across the system."
              actions={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/audit">Full audit →</Link>
                </Button>
              }
              flush
            >
              {auditEvents.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-muted text-center">
                  No audit events yet. Every state change will land here.
                </p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {auditEvents.map((e) => (
                    <li key={e.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-3 text-ink-muted flex-shrink-0 mt-0.5"
                        >
                          <ScrollText className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink-strong">
                            <span className="font-semibold uppercase text-[10px] tracking-wide text-ink-muted mr-1.5">
                              {e.action}
                            </span>
                            {e.entityType}
                          </p>
                          <p className="text-xs text-ink-muted mt-0.5 truncate">
                            {e.actor?.name ?? "System"}
                            <span className="text-ink-faint"> · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>
          </>
        }
        aside={
          <>
            {/* AI usage snapshot */}
            <RailCard icon={Sparkles} title="AI usage MTD" subtitle="Top features by spend.">
              {aiTop.length === 0 ? (
                <p className="text-sm text-ink-muted">No AI calls yet this month.</p>
              ) : (
                <ul className="space-y-2.5">
                  {aiTop.map((f) => (
                    <li key={f.feature} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-ink-strong font-medium capitalize">
                        {f.feature.replace(/_/g, " ").toLowerCase()}
                      </span>
                      <span className="text-xs tabular text-ink-muted whitespace-nowrap flex-shrink-0">
                        <span className="font-semibold text-ink-strong">${f.cost.toFixed(2)}</span>
                        <span className="text-ink-faint"> · {f.calls}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>

            {/* Recent sign-ins */}
            <RailCard icon={ActivityIcon} title="Recent sign-ins" subtitle="Latest user activity.">
              {recentSignIns.length === 0 ? (
                <p className="text-sm text-ink-muted">No sign-ins yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {recentSignIns.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-strong truncate">{u.name}</p>
                        <p className="text-[11px] text-ink-muted">{roleLabel(u.role)}</p>
                      </div>
                      <span className="text-[11px] text-ink-faint tabular whitespace-nowrap flex-shrink-0">
                        {u.lastLoginAt
                          ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </RailCard>
          </>
        }
      />
    </DashboardPage>
  );
}

function HealthPill({
  name,
  ok,
  ifOk,
  ifNot,
}: {
  name: string;
  ok: boolean;
  ifOk: string;
  ifNot: string;
}) {
  const Icon: LucideIcon = ok ? CheckCircle2 : AlertTriangle;
  const xIcon: LucideIcon = XCircle; // unused but lints clean if we ever want hard-fail tone
  void xIcon;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        ok
          ? "border-success/30 bg-success-soft/40"
          : "border-warn/30 bg-warn-soft/40"
      }`}
    >
      <span
        aria-hidden
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 mt-0.5 ${
          ok ? "bg-success text-white" : "bg-warn text-white"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-strong">{name}</p>
        <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{ok ? ifOk : ifNot}</p>
      </div>
    </div>
  );
}

function RailCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof HeartPulse;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <header className="flex items-center gap-2.5 mb-3">
        <span
          aria-hidden
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-gtn-purple"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-strong leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-ink-muted mt-0.5">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function roleLabel(role: Role): string {
  switch (role) {
    case Role.SALESPERSON:   return "Salesperson";
    case Role.SALES_MANAGER: return "Sales Manager";
    case Role.VCIO:          return "vCIO";
    case Role.COO:           return "COO";
    case Role.SUPERADMIN:    return "Superadmin";
  }
}
