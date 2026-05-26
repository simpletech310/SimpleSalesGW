import { redirect } from "next/navigation";
import Link from "next/link";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import {
  Check,
  Star,
  Sparkles,
  Layers,
  Phone,
  Cable,
  KeyRound,
  Camera,
  Wrench,
  Workflow,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/brand";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { loadCatalog } from "@/lib/pricing/loader";
import {
  SERVICE_LINE_GUIDE,
  SERVICE_LINE_TIERS,
  bundleIncludesNormalized,
  fmtUsd,
  listBundles,
} from "@/lib/pricing/catalog";
import {
  DEAL_KIND_META,
  LINE_ITEM_STICKERS,
  listDealKinds,
  type LineItemKind,
} from "@/lib/pricing/deal-kinds";
import { can } from "@/lib/rbac";
import { cn } from "@/lib/utils";

/**
 * v3.0.4 — Pricing page redesign.
 *
 * Was: long stacked sections, one per bundle, each with its own seat-tier
 * table — total page length scrolled forever.
 *
 * Now: a 3-up bundle card grid with a featured/recommended treatment on
 * the second tier, compact seat-tier table per card, and the standalone /
 * deal-kind / per-unit tables tightened so the whole page fits in two
 * screens instead of seven.
 */

const LINE_ITEM_GROUPS: ReadonlyArray<{
  label: string;
  icon: LucideIcon;
  help: string;
  kinds: ReadonlyArray<LineItemKind>;
}> = [
  { label: "Voice / Phone system",  icon: Phone,    help: "Per-extension MRR plus handset hardware. Used in Voice-only and Voice+Video deals.", kinds: ["VOICE_EXTENSION", "VOICE_HARDWARE"] },
  { label: "Structured cabling",    icon: Cable,    help: "Per-drop pricing for new cable runs (Cat6 / Cat6a, terminated and certified).",      kinds: ["CABLE_DROP"] },
  { label: "Access control",        icon: KeyRound, help: "Per-door reader + software licensing. Door hardware priced separately.",              kinds: ["DOOR_READER"] },
  { label: "Video surveillance",    icon: Camera,   help: "Per-camera MRR for monitoring + per-camera one-time install.",                        kinds: ["CAMERA", "NVR_DVR"] },
  { label: "Labor + catch-all",     icon: Wrench,   help: "Technician hours for installs and ad-hoc work. OTHER is a free-text catch-all.",      kinds: ["INSTALL_LABOR", "OTHER"] },
];

// Tier badge colour treatment per bundle. ESSENTIAL = quiet, PROFESSIONAL =
// brand (the recommended/featured one), ENTERPRISE = navy (premium).
type BundleTone = { tone: "neutral" | "brand" | "navy"; featured: boolean; icon: LucideIcon };
const DEFAULT_TONE: BundleTone = { tone: "neutral", featured: false, icon: Layers };
const BUNDLE_TONE: Record<string, BundleTone> = {
  ESSENTIAL:    { tone: "neutral", featured: false, icon: Layers },
  PROFESSIONAL: { tone: "brand",   featured: true,  icon: Star },
  ENTERPRISE:   { tone: "navy",    featured: false, icon: Sparkles },
  CUSTOM:       { tone: "neutral", featured: false, icon: Workflow },
};

export default async function PricingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const catalog = await loadCatalog();
  const bundles = listBundles(catalog);
  const standaloneEntries = Object.entries(catalog.standalone) as Array<
    [ServiceLine, { perSeatMrr: number; perSeatFloor: number; oneTime: number }]
  >;
  const canEdit = can(session.user.role, "system:config");

  return (
    <DashboardPage
      eyebrow="Service catalog"
      title="Pricing & bundles"
      subtitle="Everything Gateway sells, in one place. The Pricing card on a Lead auto-fills its sticker from these numbers."
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/help">Help center</Link>
          </Button>
          {canEdit && (
            <Button asChild size="sm">
              <Link href="/admin/pricing">Edit catalog →</Link>
            </Button>
          )}
        </>
      }
    >
      <Callout kind="tip">
        Prices below come from the live catalog (<code className="gtn-code-pill">pricing.catalog</code> in SystemConfig). When you propose pricing on a lead, the portal auto-routes approvals:{" "}
        <strong>0–5%</strong> off MRR self-approves, <strong>5–20%</strong> goes to your Sales Manager, <strong>over 20% or below-floor</strong> goes to the COO.
      </Callout>

      {/* ----------------------------------------------------------------
          Bundles — 3-up card grid (4-up if there's a CUSTOM bundle)
          ----------------------------------------------------------------*/}
      <section>
        <header className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-strong">Bundles</h2>
            <p className="text-sm text-ink-muted">Best when 60–70% of the value comes from integration across service lines.</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bundles.map((b) => {
            const includes = bundleIncludesNormalized(b);
            const isCustom = b.id === ServiceBundle.CUSTOM;
            const meta: BundleTone = BUNDLE_TONE[b.id] ?? DEFAULT_TONE;
            const Icon = meta.icon;
            const entrySticker = b.seatTiers[0]?.perSeatMrr;

            return (
              <article
                key={b.id}
                className={cn(
                  "relative rounded-2xl border bg-surface flex flex-col overflow-hidden transition-shadow duration-150 ease-smooth",
                  meta.featured
                    ? "border-brand/40 shadow-[0_4px_24px_rgba(91,79,207,0.08)]"
                    : "border-line-subtle hover:shadow-card",
                )}
              >
                {meta.featured && (
                  <div className="absolute top-3 right-3">
                    <Badge tone="brand" shape="pill" size="xs" dot>Most chosen</Badge>
                  </div>
                )}

                {/* Header band */}
                <div className={cn(
                  "px-5 pt-5 pb-4 border-b border-line-subtle",
                  meta.featured && "bg-gradient-to-br from-brand-soft/40 to-transparent",
                )}>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex items-center justify-center w-9 h-9 rounded-lg",
                        meta.tone === "brand"   && "bg-brand text-white",
                        meta.tone === "navy"    && "bg-gtn-navy text-white",
                        meta.tone === "neutral" && "bg-surface-3 text-ink-muted",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-ink-strong leading-tight">{b.label}</h3>
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">
                        {b.id.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-ink-muted leading-relaxed">{b.description}</p>

                  {/* Entry sticker call-out */}
                  {!isCustom && typeof entrySticker === "number" && (
                    <div className="mt-3.5 flex items-baseline gap-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">From</span>
                      <span className="ui-stat text-2xl tabular text-ink-strong">{fmtUsd(entrySticker)}</span>
                      <span className="text-xs text-ink-muted">/seat/mo</span>
                    </div>
                  )}
                  {isCustom && (
                    <p className="mt-3.5 text-sm font-semibold text-ink-strong">
                      Scoped per engagement
                    </p>
                  )}
                </div>

                {/* Rep guide: what / who / how / process — collapsed details
                    so the card stays compact but reps can expand to coach
                    themselves on the pitch. */}
                {b.pitch && (
                  <details className="px-5 py-3 border-b border-line-subtle group">
                    <summary className="cursor-pointer text-xs font-semibold text-gtn-purple flex items-center justify-between list-none">
                      <span>Sales-rep guide — what it is, who it&apos;s for, how we deliver</span>
                      <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
                    </summary>
                    <div className="mt-3 space-y-3 text-xs leading-relaxed">
                      <div>
                        <p className="ui-label mb-1">What it is</p>
                        <p className="text-ink">{b.pitch.whatItIs}</p>
                      </div>
                      <div>
                        <p className="ui-label mb-1">Best for</p>
                        <p className="text-ink">{b.pitch.bestFor}</p>
                      </div>
                      <div>
                        <p className="ui-label mb-1">How it helps</p>
                        <ul className="space-y-1">
                          {b.pitch.howItHelps.map((h, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="h-3 w-3 text-gtn-green mt-1 flex-shrink-0" strokeWidth={3} />
                              <span className="text-ink">{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="ui-label mb-1">Delivery process</p>
                        <p className="text-ink">{b.pitch.process}</p>
                      </div>
                    </div>
                  </details>
                )}

                {/* What's included */}
                {includes.length > 0 && (
                  <div className="px-5 py-4 flex-1">
                    <p className="ui-label mb-2.5">Includes</p>
                    <ul className="space-y-1.5">
                      {includes.map((inc, i) => (
                        <li key={`${inc.serviceLine}-${i}`} className="flex items-start gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-gtn-green mt-0.5 flex-shrink-0" strokeWidth={3} />
                          <span className="text-ink">
                            <span className="font-medium text-ink-strong capitalize">
                              {inc.serviceLine.replace(/_/g, " ").toLowerCase()}
                            </span>
                            {inc.tier && <span className="text-ink-muted"> · {inc.tier}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Seat tier table */}
                {!isCustom && b.seatTiers.length > 0 && (
                  <div className="px-5 pb-4">
                    <p className="ui-label mb-2">Per-seat MRR</p>
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-line-subtle">
                        {b.seatTiers.map((t, i) => (
                          <tr key={i}>
                            <td className="py-1.5 text-ink-muted">{t.minSeats}–{t.maxSeats} seats</td>
                            <td className="py-1.5 text-right font-mono tabular font-semibold text-ink-strong">{fmtUsd(t.perSeatMrr)}</td>
                            <td className="py-1.5 pl-3 text-right font-mono tabular text-ink-faint text-[11px]">
                              floor {fmtUsd(t.perSeatFloor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Onboarding + annual */}
                {!isCustom && (
                  <div className="border-t border-line-subtle bg-surface-2/60 px-5 py-3 space-y-1.5">
                    <p className="text-xs text-ink">
                      <span className="ui-label mr-1">Onboarding</span>
                      <span className="font-mono tabular text-ink-strong">{fmtUsd(b.onboarding.base)}</span> base{" "}
                      + <span className="font-mono tabular text-ink-strong">{fmtUsd(b.onboarding.perSeat)}</span>/seat
                    </p>
                    {b.annualAddOns && b.annualAddOns.length > 0 && b.annualAddOns.map((a, i) => (
                      <p key={i} className="text-xs text-ink-muted">
                        <span className="ui-label mr-1">Annual</span>
                        {a.label} · <span className="font-mono tabular text-ink-strong">{fmtUsd(a.amount)}</span>
                      </p>
                    ))}
                  </div>
                )}

                {isCustom && (
                  <div className="px-5 py-4 flex-1 text-sm text-ink-muted leading-relaxed">
                    No seat-tier sticker — propose manually on the lead. Best for hybrid deals that don&apos;t fit a clean bundle.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ----------------------------------------------------------------
          Sub-tiers — quiet reference grid
          ----------------------------------------------------------------*/}
      <DashboardSection
        title="Service-line sub-tiers"
        subtitle="Named tiers per offering — used when composing a custom quote."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Object.entries(SERVICE_LINE_TIERS).map(([line, tiers]) => (
            <div key={line} className="rounded-lg border border-line-subtle bg-surface-2 px-3.5 py-3">
              <p className="text-sm font-semibold text-ink-strong capitalize">
                {line.replace(/_/g, " ").toLowerCase()}
              </p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">{(tiers as string[]).join(" · ")}</p>
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* ----------------------------------------------------------------
          Service line guide — plain-English rep cheat sheet
          ----------------------------------------------------------------*/}
      <DashboardSection
        title="Service guide — what each line actually does"
        subtitle="Plain-English cheat sheet so reps can answer 'what is this?' and 'who's it for?' on a discovery call."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(Object.entries(SERVICE_LINE_GUIDE) as Array<[ServiceLine, NonNullable<typeof SERVICE_LINE_GUIDE[ServiceLine]>]>).map(([line, g]) => {
            const standalone = catalog.standalone[line];
            return (
              <details
                key={line}
                className="rounded-xl border border-line-subtle bg-surface px-4 py-3 group hover:border-line-strong transition-colors"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-strong capitalize">
                        {line.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5 leading-snug">{g.whatItIs}</p>
                    </div>
                    {standalone && (
                      <div className="text-right flex-shrink-0">
                        {standalone.perSeatMrr > 0 ? (
                          <>
                            <p className="text-xs font-mono tabular text-ink-strong">{fmtUsd(standalone.perSeatMrr)}</p>
                            <p className="text-[10px] text-ink-muted">/seat/mo</p>
                          </>
                        ) : standalone.oneTime > 0 ? (
                          <>
                            <p className="text-xs font-mono tabular text-ink-strong">{fmtUsd(standalone.oneTime)}</p>
                            <p className="text-[10px] text-ink-muted">one-time</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-ink-muted">scoped</p>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gtn-purple font-semibold mt-2 group-open:hidden">
                    Show the rep pitch ▾
                  </p>
                </summary>
                <div className="mt-3 pt-3 border-t border-line-subtle space-y-3 text-xs leading-relaxed">
                  <div>
                    <p className="ui-label mb-1">Best for</p>
                    <p className="text-ink">{g.bestFor}</p>
                  </div>
                  <div>
                    <p className="ui-label mb-1">How it helps</p>
                    <ul className="space-y-1">
                      {g.howItHelps.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3 w-3 text-gtn-green mt-1 flex-shrink-0" strokeWidth={3} />
                          <span className="text-ink">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="ui-label mb-1">How we deliver</p>
                    <p className="text-ink">{g.process}</p>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </DashboardSection>

      {/* ----------------------------------------------------------------
          Standalone service lines — sticker table
          ----------------------------------------------------------------*/}
      <DashboardSection
        title="Standalone service lines"
        subtitle="Per-seat MRR + one-time setup when sold line-by-line — no bundle discount. Access control and video are install-only (no MRR)."
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="ui-label text-left px-4 md:px-5 py-2.5">Service line</th>
                <th className="ui-label text-right px-4 md:px-5 py-2.5">Per-seat MRR</th>
                <th className="ui-label text-right px-4 md:px-5 py-2.5">Floor / seat</th>
                <th className="ui-label text-right px-4 md:px-5 py-2.5">One-time setup</th>
              </tr>
            </thead>
            <tbody>
              {standaloneEntries.map(([line, entry]) => (
                <tr key={line} className="border-t border-line-subtle hover:bg-surface-3/40 transition-colors">
                  <td className="px-4 md:px-5 py-2.5 font-medium text-ink-strong capitalize">{line.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-4 md:px-5 py-2.5 text-right font-mono tabular">{entry.perSeatMrr > 0 ? fmtUsd(entry.perSeatMrr) : "—"}</td>
                  <td className="px-4 md:px-5 py-2.5 text-right font-mono tabular text-ink-muted">{entry.perSeatFloor > 0 ? fmtUsd(entry.perSeatFloor) : "—"}</td>
                  <td className="px-4 md:px-5 py-2.5 text-right font-mono tabular">{entry.oneTime > 0 ? fmtUsd(entry.oneTime) : "scoped"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* ----------------------------------------------------------------
          Deal types — compact 2-up grid with bundle vs line-item badge
          ----------------------------------------------------------------*/}
      <DashboardSection
        title="Deal types"
        subtitle="Drives the PricingCard form and the onboarding template stack after handoff acceptance."
      >
        <div className="grid sm:grid-cols-2 gap-2.5">
          {listDealKinds().map((dk) => (
            <div key={dk.kind} className="rounded-lg border border-line-subtle bg-surface px-3.5 py-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-ink-strong">{dk.label}</p>
                {dk.usesBundles ? (
                  <Badge tone="brand" shape="pill" size="xs">Bundle</Badge>
                ) : (
                  <Badge tone="navy" shape="pill" size="xs">Line-item</Badge>
                )}
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">{dk.tagline}</p>
              {dk.serviceLines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dk.serviceLines.map((sl) => (
                    <span key={sl} className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5 capitalize">
                      {sl.replace(/_/g, " ").toLowerCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* ----------------------------------------------------------------
          Per-unit pricing (project deals)
          ----------------------------------------------------------------*/}
      <section className="space-y-3">
        <header className="flex items-end justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold text-ink-strong">Per-unit pricing (project deals)</h2>
            <p className="text-sm text-ink-muted">Voice, cabling, access, video, or custom mix — line-by-line stickers.</p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          {LINE_ITEM_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <article key={group.label} className="rounded-xl border border-line-subtle bg-surface overflow-hidden">
                <header className="flex items-start gap-3 px-4 md:px-5 py-3 border-b border-line-subtle">
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-soft text-gtn-purple flex-shrink-0"
                  >
                    <GroupIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-strong">{group.label}</p>
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{group.help}</p>
                  </div>
                </header>
                <table className="w-full text-sm">
                  <thead className="bg-surface-2/60">
                    <tr>
                      <th className="ui-label text-left px-4 md:px-5 py-2">Line item</th>
                      <th className="ui-label text-right px-3 py-2">MRR</th>
                      <th className="ui-label text-right px-3 py-2">One-time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kinds.map((kind) => {
                      const s = LINE_ITEM_STICKERS[kind];
                      return (
                        <tr key={kind} className="border-t border-line-subtle align-top">
                          <td className="px-4 md:px-5 py-2.5">
                            <p className="font-medium text-ink-strong">{s.label}</p>
                            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{s.helpText}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular whitespace-nowrap">{s.perUnitMrr > 0 ? fmtUsd(s.perUnitMrr) : "—"}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular whitespace-nowrap">{s.perUnitOneTime > 0 ? fmtUsd(s.perUnitOneTime) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            );
          })}
        </div>

        <Callout kind="tip" label="Sticker, not floor">
          These are the catalog stickers. The Salesperson can override per quote (within the approval-tier math: 0–5% self-approves, 5–20% Sales Manager, 20%+ or below-floor → COO). Sales Manager + Superadmin can edit defaults from{" "}
          <Link href="/admin/pricing" className="text-gtn-purple hover:underline font-medium">/admin/pricing</Link>.
        </Callout>
      </section>

      {/* ----------------------------------------------------------------
          Pre-sale scoping
          ----------------------------------------------------------------*/}
      <DashboardSection
        title="Pre-sale scoping (vCIO)"
        subtitle="Salesperson can request vCIO scoping help before the deal closes — right from the lead detail page."
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { key: "VOICE_SCOPING",          icon: Phone,    label: "Voice scoping",        desc: "Extensions, port-out, hardware, network readiness, special needs (e911, recording, CRM)." },
            { key: "CCTV_SCOPING",           icon: Camera,   label: "CCTV / Video",          desc: "Camera count, retention, NVR sizing, PoE budget, remote viewing." },
            { key: "ACCESS_CONTROL_SCOPING", icon: KeyRound, label: "Access control",        desc: "Door count + type, credentials, software, compliance drivers." },
            { key: "SITE_SURVEY",            icon: Settings, label: "IT Site Survey (full)", desc: "Deep IT discovery for managed-IT bundles: identity, endpoints, backups, compliance." },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="rounded-xl border border-line-subtle bg-surface px-3.5 py-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span aria-hidden className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-3 text-ink-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm font-semibold text-ink-strong">{s.label}</p>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </DashboardSection>

      <p className="text-xs text-ink-faint text-center pt-2">
        Catalog version <code className="gtn-code-pill">{catalog.version}</code>{" · "}
        currency {catalog.currency}{" · "}
        <code className="gtn-code-pill">{Object.keys(DEAL_KIND_META).length} deal kinds</code>
      </p>
    </DashboardPage>
  );
}
