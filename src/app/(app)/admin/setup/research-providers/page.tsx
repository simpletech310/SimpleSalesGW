/**
 * v3.3.28 — Admin: research-provider status.
 *
 * Server-rendered table of every OSINT provider the agentic research
 * loop can call. For each provider shows:
 *   - configured? (env var presence)
 *   - month-to-date usage (counted from ResearchArtifact rows for the
 *     matching type — no separate log table needed)
 *   - free-tier quota for reference
 *   - what falls back when the provider is unavailable
 *
 * No "Test" buttons here (Phase 3 keeps it read-only); a future
 * iteration can add a per-provider ping route.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { ResearchArtifactType } from "@prisma/client";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { integrationHealth } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { HeroBand } from "@/components/brand";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type Row = {
  name: string;
  envVar: string | null;
  configured: boolean;
  /** Type of artifact to count for MTD usage. */
  artifactType: ResearchArtifactType | null;
  monthToDate: number;
  freeTierQuota: string;
  fallback: string;
  notes: string;
};

export default async function ResearchProvidersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "pricing:catalog:edit") && !can(session.user.role, "user:manage")) {
    redirect("/");
  }

  const health = integrationHealth();

  // Count this month's artifact rows per type. One DB query, grouped.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const usageRows = await prisma.researchArtifact.groupBy({
    by: ["type"],
    where: { createdAt: { gte: monthStart } },
    _count: { _all: true },
  });
  const usageByType = new Map<ResearchArtifactType, number>();
  for (const row of usageRows) {
    usageByType.set(row.type, row._count._all);
  }
  const count = (t: ResearchArtifactType | null) => (t ? (usageByType.get(t) ?? 0) : 0);

  const rows: Row[] = [
    {
      name: "Anthropic Claude (agent loop)",
      envVar: "ANTHROPIC_API_KEY",
      configured: health.anthropic.configured,
      artifactType: ResearchArtifactType.AGENT_BRIEFING,
      monthToDate: count(ResearchArtifactType.AGENT_BRIEFING),
      freeTierQuota: "Paid per-token (~$0.01-0.05 per lead)",
      fallback: "If missing, gather still seed-scrapes but no agent loop fires.",
      notes: "Required for the agentic research loop. Without it, gather only runs the deterministic seed-scrape.",
    },
    {
      name: "Tavily Search",
      envVar: "TAVILY_API_KEY",
      configured: health.tavily.configured,
      artifactType: ResearchArtifactType.WEB_SEARCH_RESULT,
      monthToDate: count(ResearchArtifactType.WEB_SEARCH_RESULT),
      freeTierQuota: "1,000 queries/mo (free)",
      fallback: "Falls through to Brave, then DuckDuckGo.",
      notes: "LLM-grounded search — best snippet quality. Highly recommended.",
    },
    {
      name: "Brave Search",
      envVar: "BRAVE_SEARCH_API_KEY",
      configured: health.brave.configured,
      artifactType: ResearchArtifactType.WEB_SEARCH_RESULT,
      monthToDate: 0, // Same artifact type as Tavily — can't separate without a provider column.
      freeTierQuota: "2,000 queries/mo (free)",
      fallback: "Falls through to DuckDuckGo HTML.",
      notes: "Secondary search provider. MTD count shown for Tavily includes Brave + DDG hits too (artifact type is shared).",
    },
    {
      name: "DuckDuckGo HTML",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.WEB_SEARCH_RESULT,
      monthToDate: 0,
      freeTierQuota: "Unlimited (no key required)",
      fallback: "—",
      notes: "Always-on fallback. Lower quality, occasionally rate-limited.",
    },
    {
      name: "Hunter.io",
      envVar: "HUNTER_API_KEY",
      configured: health.hunter.configured,
      artifactType: ResearchArtifactType.EMAIL_DISCOVERY,
      monthToDate: count(ResearchArtifactType.EMAIL_DISCOVERY),
      freeTierQuota: "25 lookups/mo (free)",
      fallback: "Falls back to regex over already-fetched pages.",
      notes: "Domain → emails. Low free-tier ceiling — use sparingly.",
    },
    {
      name: "NCUA (credit unions)",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.NCUA_LOOKUP,
      monthToDate: count(ResearchArtifactType.NCUA_LOOKUP),
      freeTierQuota: "Unlimited (public)",
      fallback: "—",
      notes: "Authoritative employee/branch/asset data. Bypasses Cloudflare for credit-union targets.",
    },
    {
      name: "FDIC BankFind",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.FDIC_LOOKUP,
      monthToDate: count(ResearchArtifactType.FDIC_LOOKUP),
      freeTierQuota: "Unlimited (public)",
      fallback: "—",
      notes: "All insured US banks + thrifts. Use for FINANCIAL_SERVICES leads that aren't credit unions.",
    },
    {
      name: "SEC EDGAR",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.SEC_LOOKUP,
      monthToDate: count(ResearchArtifactType.SEC_LOOKUP),
      freeTierQuota: "Unlimited (public, fair-access UA required)",
      fallback: "—",
      notes: "CIK + most-recent 10-K url for any US public filer.",
    },
    {
      name: "ProPublica Nonprofit Explorer",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.NONPROFIT_LOOKUP,
      monthToDate: count(ResearchArtifactType.NONPROFIT_LOOKUP),
      freeTierQuota: "Unlimited (public)",
      fallback: "—",
      notes: "Form 990 data (revenue, assets, employees) for every US 501(c).",
    },
    {
      name: "OpenCorporates",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.BUSINESS_REGISTRY_LOOKUP,
      monthToDate: count(ResearchArtifactType.BUSINESS_REGISTRY_LOOKUP),
      freeTierQuota: "Rate-limited (no key on free tier)",
      fallback: "—",
      notes: "State business registries — entity type, status, incorporation date.",
    },
    {
      name: "DNS / MX lookup",
      envVar: null,
      configured: true,
      artifactType: ResearchArtifactType.DNS_LOOKUP,
      monthToDate: count(ResearchArtifactType.DNS_LOOKUP),
      freeTierQuota: "Unlimited (Node built-in)",
      fallback: "—",
      notes: "Reveals mail provider (M365/Workspace), hosting (Cloudflare/AWS), and SPF senders.",
    },
  ];

  const totalCalls = Array.from(usageByType.values()).reduce((a, b) => a + b, 0);
  const totalBriefings = count(ResearchArtifactType.AGENT_BRIEFING);

  return (
    <div className="space-y-6">
      <HeroBand
        eyebrow="RESEARCH PROVIDERS"
        title="OSINT data sources"
        subtitle="Free-tier providers powering the agentic lead-research loop. Every provider is optional; missing keys degrade gracefully."
      >
        <div className="grid grid-cols-3 gap-4 max-w-md">
          <Stat label="Artifacts MTD" value={totalCalls} />
          <Stat label="Briefings MTD" value={totalBriefings} />
          <Stat label="Configured" value={`${rows.filter((r) => r.configured).length}/${rows.length}`} />
        </div>
      </HeroBand>

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/setup">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to setup
          </Link>
        </Button>
      </div>

      <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Provider</th>
                <th className="text-left px-4 py-3 font-semibold">Env var</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">MTD usage</th>
                <th className="text-left px-4 py-3 font-semibold">Free tier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.name}
                  className={i === 0 ? "" : "border-t border-line-subtle"}
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-ink-strong">{r.name}</p>
                    <p className="text-xs text-ink-muted mt-0.5 leading-snug">{r.notes}</p>
                    {r.fallback !== "—" && (
                      <p className="text-[11px] text-ink-muted mt-1 italic">
                        Fallback: {r.fallback}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.envVar ? (
                      <code className="font-mono text-[11px] bg-surface-2 px-1.5 py-0.5 rounded text-ink-strong whitespace-nowrap">
                        {r.envVar}
                      </code>
                    ) : (
                      <span className="text-xs text-ink-muted italic">no key</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    {r.configured ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gtn-green font-semibold">
                        <CheckCircle2 className="h-4 w-4" /> Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gtn-amber font-semibold">
                        <AlertCircle className="h-4 w-4" /> Not configured
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular">
                    {r.monthToDate.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-ink-muted">
                    {r.freeTierQuota}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-brand-soft border border-gtn-purple/30 p-4 md:p-5">
        <h3 className="text-sm font-semibold text-gtn-navy mb-2">How the agent picks providers</h3>
        <ul className="text-sm text-gtn-navy/90 leading-relaxed list-disc list-inside space-y-1">
          <li>
            Web search calls <strong>Tavily → Brave → DuckDuckGo</strong> in order; the first
            provider that returns results wins.
          </li>
          <li>
            Industry-specific lookups (NCUA / FDIC / ProPublica / SEC) are surfaced first to
            the model when the lead&apos;s industry matches — bypasses Cloudflare-fronted homepages.
          </li>
          <li>
            DNS and OpenCorporates run regardless of industry — DNS for tech-stack inference,
            OpenCorporates for entity-type / registration confirmation.
          </li>
          <li>
            Hunter.io is called once the agent confirms the canonical domain. When the 25/mo
            free tier runs out, the tool silently falls back to regex over already-fetched pages.
          </li>
        </ul>
        <p className="text-xs text-gtn-navy/80 mt-3 pt-3 border-t border-gtn-purple/20">
          Set missing keys in <strong>Vercel → Settings → Environment Variables</strong> and
          redeploy. Defaults already work without any keys — just slower.
        </p>
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
