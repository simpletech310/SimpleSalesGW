import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  ScrollText,
  Settings,
  DollarSign,
  Mail,
  MessageCircle,
  Sparkles,
  Building2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { integrationHealth } from "@/lib/env";
import { DashboardPage, DashboardSection } from "@/components/templates";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (
    !can(role, "user:manage") &&
    !can(role, "audit:view") &&
    !can(role, "system:config") &&
    !can(role, "pricing:catalog:edit")
  ) {
    redirect("/");
  }

  const health = integrationHealth();
  const auditEvents = can(role, "audit:view")
    ? await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true } } },
      })
    : [];

  const healthItems = [
    { name: "Database",       ok: health.database.configured,    note: health.database.configured ? "Connected" : "DATABASE_URL missing" },
    { name: "Auth secret",    ok: health.authSecretStable,       note: health.authSecretStable ? "Stable across deploys" : "Ephemeral — set AUTH_SECRET" },
    { name: "Email (Resend)", ok: health.resend.configured,      note: health.resend.configured ? "Magic-link + outreach live" : "Magic-link + outreach disabled" },
    { name: "Gateway AI",     ok: health.anthropic.configured,   note: health.anthropic.configured ? "AI features live" : "Auto-summary disabled" },
    { name: "Blob storage",   ok: health.blob.configured,        note: health.blob.configured ? "File uploads live" : "File uploads disabled" },
    { name: "Mapbox",         ok: health.mapbox.configured,      note: health.mapbox.configured ? "Maps + geocoding live" : "/leads/map degraded" },
    { name: "Daily.co",       ok: health.daily.configured,       note: health.daily.configured ? "Video/audio live" : "Video/audio disabled" },
  ];
  const okCount = healthItems.filter((h) => h.ok).length;

  return (
    <DashboardPage
      eyebrow="Administration"
      title="Admin"
      subtitle="Manage users, system config, pricing, content, and audit history."
    >
      {(can(role, "pricing:catalog:edit") || can(role, "user:manage")) && (
        <Link
          href="/admin/setup"
          className="block rounded-xl bg-gradient-to-br from-brand-soft to-surface border border-line p-5 hover:border-brand transition-colors group"
        >
          <div className="flex items-start gap-4">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gtn-purple text-white shadow-card">
              <Zap className="h-6 w-6" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-ink-strong">First-run setup</h2>
              <p className="text-sm text-ink-muted mt-1 max-w-2xl">
                Walk through the 6 steps to make this portal usable for your team day-to-day — env health, real users, pricing catalog, prospect import, library customization, and email test.
              </p>
            </div>
            <span className="text-gtn-purple text-2xl group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>
      )}

      {/* Integration health — single horizontal strip above tiles */}
      <DashboardSection
        title="Integration health"
        subtitle={`${okCount} of ${healthItems.length} services configured.`}
        actions={
          <Link href="/admin/setup" className="text-xs text-gtn-purple hover:underline font-medium">
            Run setup wizard →
          </Link>
        }
      >
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {healthItems.map((h) => {
            const Icon = h.ok ? CheckCircle2 : AlertTriangle;
            return (
              <li
                key={h.name}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
                  h.ok
                    ? "border-success/30 bg-success-soft/40"
                    : "border-warn/30 bg-warn-soft/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0 mt-0.5 ${
                    h.ok ? "bg-success text-white" : "bg-warn text-white"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-strong leading-tight">{h.name}</p>
                  <p className="text-[10px] text-ink-muted mt-0.5 leading-relaxed">{h.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </DashboardSection>

      {/* Admin tools — tile grid */}
      <DashboardSection title="Admin tools" subtitle="Jump into the specific surface you need.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {can(role, "user:manage") && (
            <AdminTile icon={Users} href="/admin/users" title="Users" desc="Create, edit, deactivate accounts." />
          )}
          {can(role, "audit:view") && (
            <AdminTile icon={ScrollText} href="/admin/audit" title="Audit log" desc="Every state change is recorded here." />
          )}
          {can(role, "system:config") && (
            <AdminTile icon={Settings} href="/admin/config" title="System config" desc="Tune scoring thresholds + weights." />
          )}
          {can(role, "pricing:catalog:edit") && (
            <AdminTile icon={DollarSign} href="/admin/pricing" title="Pricing catalog" desc="Edit bundle prices, floors, and onboarding fees." />
          )}
          {can(role, "sow:template:edit") && (
            <AdminTile icon={FileText} href="/admin/sow-templates" title="SOW templates" desc="Library of Statement-of-Work skeletons salespeople pick from when drafting proposals." />
          )}
          {can(role, "system:config") && (
            <AdminTile icon={Mail} href="/admin/outreach" title="Outreach templates" desc="Manage the cold-outreach + follow-up library." />
          )}
          {can(role, "system:config") && (
            <AdminTile icon={MessageCircle} href="/admin/objections" title="Objections library" desc="Catalog of objections + tested rebuttals." />
          )}
          {can(role, "audit:view") && (
            <AdminTile icon={Sparkles} href="/admin/ai-usage" title="AI usage" desc="Month-to-date Gateway AI spend by feature, lead, and user." />
          )}
          {can(role, "audit:view") && (
            <AdminTile icon={Sparkles} href="/admin/ai-features" title="AI features" desc="Catalog of every Gateway AI engagement — what each does, what it reads, how it's grounded." />
          )}
          {can(role, "msp:profile:edit") && (
            <AdminTile icon={Building2} href="/admin/msp-profile" title="MSP profile" desc="Mission, brand voice, services emphasis, win stories — feeds every Gateway AI prompt." />
          )}
        </div>
      </DashboardSection>

      {/* Recent audit events */}
      {can(role, "audit:view") && (
        <DashboardSection
          title="Recent audit events"
          subtitle="Last 8 state changes across the system."
          actions={
            <Link href="/admin/audit" className="text-xs text-gtn-purple hover:underline font-medium">
              Full audit →
            </Link>
          }
          flush
        >
          {auditEvents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted text-center">
              No audit events yet. Every state change will land here as users start working.
            </p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {auditEvents.map((e) => (
                <li key={e.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        aria-hidden
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-surface-3 text-ink-muted flex-shrink-0"
                      >
                        <ScrollText className="h-3 w-3" />
                      </span>
                      <span className="text-xs font-mono uppercase tracking-wide text-ink-muted font-semibold flex-shrink-0">
                        {e.action}
                      </span>
                      <span className="text-sm text-ink-strong truncate">{e.entityType}</span>
                    </div>
                    <p className="text-xs text-ink-muted ml-auto flex-shrink-0">
                      {e.actor?.name ?? "System"}
                      <span className="text-ink-faint"> · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      )}
    </DashboardPage>
  );
}

function AdminTile({
  icon: Icon,
  href,
  title,
  desc,
}: {
  icon: LucideIcon;
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl bg-surface border border-line-subtle p-4 md:p-5 hover:border-line-strong hover:shadow-card transition-all duration-120 ease-smooth"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand-soft text-gtn-purple flex-shrink-0">
          <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-strong">{title}</h2>
          <p className="text-sm text-ink-muted mt-0.5 line-clamp-2">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
