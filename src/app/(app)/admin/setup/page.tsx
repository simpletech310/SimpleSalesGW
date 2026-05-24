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
} from "lucide-react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { integrationHealth } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HeroBand } from "@/components/brand";
import { ImportProspectsButton } from "./ImportProspectsButton";
import { BackfillAccountsButton } from "./BackfillAccountsButton";
import { WipeLeadsButton } from "./WipeLeadsButton";

export const dynamic = "force-dynamic";

/**
 * v2.14 — First-run setup wizard.
 *
 * Visible to SUPERADMIN + SALES_MANAGER. Walks the operator through:
 *   1. Environment health (auto-detected from env)
 *   2. Add real team
 *   3. Tune pricing catalog
 *   4. Import 25 starter prospects
 *   5. Customize objections / outreach
 *   6. Test email delivery (placeholder for a future "send myself a magic link")
 *
 * Designed so that on a fresh deploy, the operator hits /admin/setup once
 * and walks out with a tool their team can use tomorrow.
 */
export default async function SetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!can(role, "pricing:catalog:edit") && !can(role, "user:manage")) {
    redirect("/");
  }

  const health = integrationHealth();

  // Count signals so the wizard can show progress
  const [userCount, leadCount, customerCount] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.lead.count(),
    prisma.customer.count(),
  ]);
  const realTeamCount = userCount; // exact-count is enough for the hint
  const hasProspects = leadCount > 0;

  return (
    <div className="space-y-6">
      <HeroBand
        eyebrow="SETUP"
        title="First-run setup"
        subtitle="Walk through these steps once and the portal is ready for your team to use day to day."
      >
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <Stat label="Active users" value={realTeamCount} />
          <Stat label="Leads" value={leadCount} />
          <Stat label="Customers" value={customerCount} />
        </div>
      </HeroBand>

      {/* Step 1 — Environment health */}
      <Step
        n={1}
        title="Environment health"
        icon={ShieldCheck}
        complete={health.authSecretStable && health.database.configured}
      >
        <ul className="text-sm space-y-2 mt-2">
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
        </ul>
        <p className="text-xs text-gtn-grey-2 mt-3">
          Set missing values in <strong>Vercel → Project Settings → Environment Variables → Production</strong>,
          then trigger a redeploy.
        </p>
      </Step>

      {/* Step 2 — Add real team */}
      <Step
        n={2}
        title="Add your real team"
        icon={Users}
        complete={realTeamCount > 5}
      >
        <p className="text-sm text-gtn-grey-2 mt-2">
          The portal seeds 5 fake users for the demo. Add yourself with your real email + role
          SUPERADMIN, then add your COO, vCIO, and each salesperson. If <code>RESEND_API_KEY</code> is
          configured, each new user gets a magic-link invite automatically. Otherwise, share the
          password with them manually.
        </p>
        <Button asChild className="mt-3">
          <Link href="/admin/users">Open user manager</Link>
        </Button>
        {realTeamCount <= 5 && (
          <p className="text-xs text-gtn-amber mt-2">Only seed users exist so far. Add your real team.</p>
        )}
      </Step>

      {/* Step 3 — Review pricing */}
      <Step
        n={3}
        title="Review pricing catalog"
        icon={DollarSign}
        complete={false /* manual step — always show */}
      >
        <p className="text-sm text-gtn-grey-2 mt-2">
          Adjust bundle MRRs, seat tiers, onboarding fees, or floors. Changes propagate immediately
          to every quote, PricingCard auto-fill, and approval-tier calculation across the portal.
        </p>
        <Button asChild className="mt-3" variant="secondary">
          <Link href="/admin/pricing">Edit pricing catalog</Link>
        </Button>
      </Step>

      {/* Step 4 — Import prospects */}
      <Step
        n={4}
        title="Import 25 starter prospects"
        icon={Download}
        complete={hasProspects}
      >
        <p className="text-sm text-gtn-grey-2 mt-2">
          Seed the 25-row Burbank-area prospect shortlist as Leads owned by{" "}
          <code>lin@gatewaytelnet.com</code> (or your default salesperson). Idempotent — running
          twice won&apos;t duplicate.
        </p>
        <div className="mt-3">
          <ImportProspectsButton />
        </div>
        {hasProspects && (
          <p className="text-xs text-gtn-green mt-2">
            {leadCount} lead{leadCount === 1 ? "" : "s"} already in the system.
          </p>
        )}
      </Step>

      {/* Step 5 — Customize libraries */}
      <Step
        n={5}
        title="Customize objections + outreach"
        icon={MessageSquare}
        complete={false}
      >
        <p className="text-sm text-gtn-grey-2 mt-2">
          Review the seeded objection-rebuttal library and cold-outreach templates. Edit any that
          don&apos;t match your tone of voice.
        </p>
        <div className="flex gap-2 mt-3">
          <Button asChild variant="secondary">
            <Link href="/admin/objections">Objections</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/outreach">Outreach</Link>
          </Button>
        </div>
      </Step>

      {/* Step 6 — Test email */}
      <Step
        n={6}
        title="Test email delivery"
        icon={Mail}
        complete={false}
      >
        <p className="text-sm text-gtn-grey-2 mt-2">
          {health.resend.configured
            ? "Resend is configured. Sign out, sign back in via the magic-link tab using your real email to confirm delivery before your team relies on it."
            : "RESEND_API_KEY isn't set yet, so magic links won't send and outreach emails won't deliver. Set it in Vercel env, then come back here."}
        </p>
        <Button asChild variant="secondary" className="mt-3">
          <Link href="/login">Go to login</Link>
        </Button>
      </Step>

      {/* v2.18 — Destructive: wipe every Lead row + cascaded children.
          Use after a demo run or whenever you want a clean slate for the
          Burbank prospect bulk import. SUPERADMIN only; two-click confirm. */}
      {can(role, "user:manage") && (
        <Card>
          <h2 className="text-base font-semibold text-gtn-navy mb-2">
            Reset all leads
          </h2>
          <p className="text-sm text-gtn-grey-2 mb-3">
            Permanently delete every <code>Lead</code> row (cascades to
            Activities, Notes, Assessments, Handoffs, PricingApprovals,
            DiscoveryAssessments, SignedDocuments, and any Customer whose
            lead is removed). Use this before bulk-importing the prospect
            shortlist if you want a clean DB. <strong>Irreversible.</strong>
          </p>
          <WipeLeadsButton />
        </Card>
      )}

      {/* v2.15.2 — orphan-accounts recovery. If any accepted handoff
          didn't produce a Customer (data drift from v2.0-B rollout, or a
          partial accept-route failure), this button fixes them all. */}
      <Card>
        <h2 className="text-base font-semibold text-gtn-navy mb-2">
          Recover orphaned accounts
        </h2>
        <p className="text-sm text-gtn-grey-2 mb-3">
          If a Sales-to-Ops handoff was accepted but no Customer record exists
          under <code>/accounts</code>, click below. Scans all accepted handoffs
          and creates the missing Customer rows. Idempotent — safe to run anytime.
        </p>
        <BackfillAccountsButton />
      </Card>

      <Card className="bg-gtn-lavender border-gtn-purple/40">
        <p className="text-sm text-gtn-navy">
          <strong>Done?</strong> Run an end-to-end deal as a test:
          sign in as <code>lin@</code> → create a lead from a prospect →
          run discovery → request pricing → close-won → handoff → sign in as
          <code> coo@</code> → accept the handoff → sign in as <code>teejay@</code> →
          run the new customer through onboarding.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="gtn-eyebrow">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
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
  icon: typeof Users;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
            complete ? "bg-gtn-green-bg text-gtn-green" : "bg-gtn-lavender text-gtn-purple"
          }`}
        >
          {complete ? <CheckCircle2 className="h-5 w-5" /> : n}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gtn-navy flex items-center gap-2">
            <Icon className="h-4 w-4 text-gtn-purple" /> {title}
          </h2>
          {children}
        </div>
      </div>
    </Card>
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
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-gtn-green flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${critical ? "text-gtn-red" : "text-gtn-amber"}`} />
      )}
      <div className="flex-1 min-w-0">
        <span className="text-gtn-navy">{label}</span>
        {!ok && (
          <p className="text-xs text-gtn-grey-2 mt-0.5">
            Set <code className="text-gtn-purple">{varName}</code> — {hint}
          </p>
        )}
      </div>
    </li>
  );
}
