import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Users,
  DollarSign,
  Download,
  Mail,
  MessageSquare,
  ShieldCheck,
  Trash2,
  Wrench,
  Search,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { integrationHealth } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { HeroBand } from "@/components/brand";
import { cn } from "@/lib/utils";
import { ImportProspectsButton } from "./ImportProspectsButton";
import { BackfillAccountsButton } from "./BackfillAccountsButton";
import { WipeLeadsButton } from "./WipeLeadsButton";

export const dynamic = "force-dynamic";

/**
 * v3.1.4 — Setup wizard rebuilt on v3 tokens. Step pills use the v3
 * brand palette; environment-health uses Badge per row.
 */
export default async function SetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!can(role, "pricing:catalog:edit") && !can(role, "user:manage")) {
    redirect("/");
  }

  const health = integrationHealth();

  const [userCount, leadCount, customerCount] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.customer.count(),
  ]);
  const hasProspects = leadCount > 0;
  const hasRealTeam = userCount > 5;

  const completedCount = [
    health.authSecretStable && health.database.configured,
    hasRealTeam,
    false, // pricing is manual review
    hasProspects,
    false, // libraries manual
    health.resend.configured,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <HeroBand
        eyebrow="SETUP"
        title="First-run setup"
        subtitle="Walk through these steps once and the portal is ready for your team to use day to day."
      >
        <div className="grid grid-cols-4 gap-4 max-w-lg">
          <Stat label="Progress" value={`${completedCount}/6`} />
          <Stat label="Users" value={userCount} />
          <Stat label="Leads" value={leadCount} />
          <Stat label="Customers" value={customerCount} />
        </div>
      </HeroBand>

      <Step
        n={1}
        title="Environment health"
        icon={ShieldCheck}
        complete={health.authSecretStable && health.database.configured}
      >
        <ul className="text-sm space-y-2.5 mt-3">
          <HealthRow
            label="AUTH_SECRET (stable session secret)"
            ok={health.authSecretStable}
            varName="AUTH_SECRET"
            hint="Generate with: openssl rand -base64 32"
            critical
          />
          <HealthRow
            label="DATABASE_URL (Postgres)"
            ok={health.database.configured}
            varName="DATABASE_URL"
            hint="Required — app cannot run without it"
            critical
          />
          <HealthRow
            label="RESEND_API_KEY (email)"
            ok={health.resend.configured}
            varName="RESEND_API_KEY"
            hint="Optional — without it, magic-link sign-in is disabled (password fallback works)"
          />
          <HealthRow
            label="BLOB_READ_WRITE_TOKEN (file uploads)"
            ok={health.blob.configured}
            varName="BLOB_READ_WRITE_TOKEN"
            hint="Optional — without it, attachment + signed-document uploads return 503"
          />
          <HealthRow
            label="ANTHROPIC_API_KEY (auto research summary)"
            ok={health.anthropic.configured}
            varName="ANTHROPIC_API_KEY"
            hint="Optional — without it, you can still scrape sources but won't get an auto summary"
          />
          {/* v3.3.28 — Phase-1 OSINT provider keys. Every one is optional;
              the agentic research loop falls through cleanly when absent. */}
          <HealthRow
            label="TAVILY_API_KEY (LLM-grounded web search)"
            ok={health.tavily.configured}
            varName="TAVILY_API_KEY"
            hint="Optional — 1000 free queries/mo. Falls back to Brave / DuckDuckGo when missing."
          />
          <HealthRow
            label="BRAVE_SEARCH_API_KEY (search fallback)"
            ok={health.brave.configured}
            varName="BRAVE_SEARCH_API_KEY"
            hint="Optional — 2000 free queries/mo. Used when Tavily quota is hit. Falls back to DDG."
          />
          <HealthRow
            label="HUNTER_API_KEY (domain → emails)"
            ok={health.hunter.configured}
            varName="HUNTER_API_KEY"
            hint="Optional — 25 free lookups/mo. Falls back to regex over scraped pages."
          />
        </ul>
        <p className="text-xs text-ink-muted mt-4 pt-3 border-t border-line-subtle">
          Set missing values in <strong className="text-ink-strong">Vercel → Project Settings → Environment Variables → Production</strong>,
          then trigger a redeploy.
        </p>
      </Step>

      <Step n={2} title="Add your real team" icon={Users} complete={hasRealTeam}>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          The portal seeds 5 fake users for the demo. Add yourself with your real email + role
          <Badge tone="warn" shape="pill" size="xs" className="mx-1">SUPERADMIN</Badge>,
          then add your COO, vCIO, and each salesperson. If <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong">RESEND_API_KEY</code> is
          configured, each new user gets a magic-link invite automatically. Otherwise, share the
          password with them manually.
        </p>
        <Button asChild className="mt-3" size="sm">
          <Link href="/admin/users">Open user manager</Link>
        </Button>
        {!hasRealTeam && (
          <p className="text-xs text-gtn-amber mt-3 inline-flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Only seed users exist so far. Add your real team.
          </p>
        )}
      </Step>

      <Step n={3} title="Review pricing catalog" icon={DollarSign} complete={false}>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Adjust bundle MRRs, seat tiers, onboarding fees, or floors. Changes propagate immediately
          to every quote, PricingCard auto-fill, and approval-tier calculation across the portal.
        </p>
        <Button asChild className="mt-3" variant="secondary" size="sm">
          <Link href="/admin/pricing">Edit pricing catalog</Link>
        </Button>
      </Step>

      <Step n={4} title="Import 25 starter prospects" icon={Download} complete={hasProspects}>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Seed the 25-row Burbank-area prospect shortlist as Leads owned by{" "}
          <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong">lin@gatewaytelnet.com</code>{" "}
          (or your default salesperson). Idempotent — running twice won&apos;t duplicate.
        </p>
        <div className="mt-3">
          <ImportProspectsButton />
        </div>
        {hasProspects && (
          <p className="text-xs text-gtn-green mt-3 inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {leadCount} lead{leadCount === 1 ? "" : "s"} already in the system.
          </p>
        )}
      </Step>

      <Step n={5} title="Customize objections + outreach" icon={MessageSquare} complete={false}>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          Review the seeded objection-rebuttal library and cold-outreach templates. Edit any that
          don&apos;t match your tone of voice.
        </p>
        <div className="flex gap-2 mt-3">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/objections">Objections</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/outreach">Outreach</Link>
          </Button>
        </div>
      </Step>

      <Step n={6} title="Test email delivery" icon={Mail} complete={health.resend.configured}>
        <p className="text-sm text-ink-muted mt-2 leading-relaxed">
          {health.resend.configured
            ? "Resend is configured. Sign out, sign back in via the magic-link tab using your real email to confirm delivery before your team relies on it."
            : "RESEND_API_KEY isn't set yet, so magic links won't send and outreach emails won't deliver. Set it in Vercel env, then come back here."}
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-3">
          <Link href="/login">Go to login</Link>
        </Button>
      </Step>

      {/* v3.3.28 — link to the dedicated research-providers status page */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-start gap-3">
          <Search className="h-5 w-5 text-ink-muted flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-ink-strong">Research providers</h2>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              Per-provider status + month-to-date usage across the agentic OSINT loop
              (Tavily, Brave, DDG, Hunter, NCUA, FDIC, SEC, ProPublica, OpenCorporates, DNS).
              All providers are optional; the loop degrades gracefully when keys are missing.
            </p>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href="/admin/setup/research-providers">
                Open provider status <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="hidden sm:flex flex-col gap-1 text-right text-xs flex-shrink-0">
            <ProviderBadge ok={health.tavily.configured} label="Tavily" />
            <ProviderBadge ok={health.brave.configured} label="Brave" />
            <ProviderBadge ok={health.hunter.configured} label="Hunter" />
          </div>
        </div>
      </div>

      {/* Maintenance actions */}
      <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
        <div className="flex items-start gap-3 mb-4">
          <Wrench className="h-5 w-5 text-ink-muted flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-ink-strong">Maintenance</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Tools for keeping the database consistent. Safe to run anytime.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-line-subtle p-4 bg-surface-2/40 mb-3">
          <h3 className="text-sm font-semibold text-ink-strong">Recover orphaned accounts</h3>
          <p className="text-sm text-ink-muted mt-1 mb-3 leading-relaxed">
            If a Sales-to-Ops handoff was accepted but no Customer record exists
            under <code className="font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-ink-strong">/accounts</code>, click below. Scans all accepted handoffs
            and creates the missing Customer rows. Idempotent — safe to run anytime.
          </p>
          <BackfillAccountsButton />
        </div>

        {can(role, "user:manage") && (
          <div className="rounded-lg border border-danger/30 p-4 bg-danger-soft/30">
            <h3 className="text-sm font-semibold text-gtn-red inline-flex items-center gap-1.5">
              <Trash2 className="h-4 w-4" /> Reset all leads
            </h3>
            <p className="text-sm text-ink-muted mt-1 mb-3 leading-relaxed">
              Permanently delete every <code className="font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-ink-strong">Lead</code> row (cascades to
              Activities, Notes, Assessments, Handoffs, PricingApprovals,
              DiscoveryAssessments, SignedDocuments, and any Customer whose
              lead is removed). Use this before bulk-importing the prospect
              shortlist if you want a clean DB. <strong className="text-gtn-red">Irreversible.</strong>
            </p>
            <WipeLeadsButton />
          </div>
        )}
      </div>

      {/* Walk-through card */}
      <div className="rounded-xl bg-brand-soft border border-gtn-purple/30 p-4 md:p-5">
        <h3 className="text-sm font-semibold text-gtn-navy mb-2">Done? Try an end-to-end deal as a test</h3>
        <ol className="text-sm text-gtn-navy/90 leading-relaxed list-decimal list-inside space-y-1">
          <li>Sign in as <code className="font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-ink-strong">lin@</code> → create a lead from a prospect</li>
          <li>Run discovery → request pricing → close-won → handoff</li>
          <li>Sign in as <code className="font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-ink-strong">coo@</code> → accept the handoff</li>
          <li>Sign in as <code className="font-mono text-[10px] bg-surface px-1.5 py-0.5 rounded text-ink-strong">teejay@</code> → run the new customer through onboarding</li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="gtn-eyebrow">{label}</p>
      <p className="text-2xl font-bold text-white tabular">{value}</p>
    </div>
  );
}

function Step({
  n,
  title,
  icon: Icon,
  complete,
  children,
}: {
  n: number;
  title: string;
  icon: LucideIcon;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border",
            complete
              ? "bg-success-soft text-gtn-green border-transparent"
              : "bg-brand-soft text-gtn-purple border-transparent",
          )}
        >
          {complete ? <CheckCircle2 className="h-5 w-5" /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-ink-strong flex items-center gap-2">
            <Icon className="h-4 w-4 text-gtn-purple" /> {title}
          </h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function ProviderBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
        ok ? "bg-success-soft text-gtn-green" : "bg-surface-2 text-ink-muted",
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full bg-ink-muted/40" />}
      {label}
    </span>
  );
}

function HealthRow({
  label,
  ok,
  varName,
  hint,
  critical,
}: {
  label: string;
  ok: boolean;
  varName: string;
  hint: string;
  critical?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-gtn-green flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle
          className={cn("h-4 w-4 flex-shrink-0 mt-0.5", critical ? "text-gtn-red" : "text-gtn-amber")}
        />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-ink-strong">{label}</span>
        {ok ? (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-gtn-green font-semibold">configured</span>
        ) : (
          <p className="text-xs text-ink-muted mt-0.5">
            Set <code className="font-mono text-[10px] bg-surface-2 px-1.5 py-0.5 rounded text-gtn-purple font-semibold">{varName}</code> — {hint}
          </p>
        )}
      </div>
    </li>
  );
}
