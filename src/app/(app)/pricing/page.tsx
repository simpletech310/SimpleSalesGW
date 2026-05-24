import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, Server, Shield, Sparkles } from "lucide-react";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import { auth } from "@/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HeroBand, IconTile, Callout, Pill } from "@/components/brand";
import { loadCatalog } from "@/lib/pricing/loader";
import {
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

/**
 * v2.18 — Per-unit line-item pricing for project-style deals (voice,
 * cabling, access, video, custom mix). Grouped into the same categories
 * the ServiceQuoteCard builder uses so the salesperson can cross-
 * reference what they'll see in the quote builder.
 */
const LINE_ITEM_GROUPS: ReadonlyArray<{ label: string; help: string; kinds: ReadonlyArray<LineItemKind> }> = [
  {
    label: "Voice / Phone system",
    help: "Per-extension MRR plus handset hardware. Used in Voice-only and Voice+Video deals.",
    kinds: ["VOICE_EXTENSION", "VOICE_HARDWARE"],
  },
  {
    label: "Structured cabling",
    help: "Per-drop pricing for new cable runs (Cat6 / Cat6a, terminated and certified).",
    kinds: ["CABLE_DROP"],
  },
  {
    label: "Access control",
    help: "Per-door reader + software licensing. Door hardware (strike, REX, contacts) priced separately.",
    kinds: ["DOOR_READER"],
  },
  {
    label: "Video surveillance",
    help: "Per-camera MRR for monitoring + per-camera one-time install. NVR/DVR sized per site.",
    kinds: ["CAMERA", "NVR_DVR"],
  },
  {
    label: "Labor + catch-all",
    help: "Technician hours for installs and ad-hoc work. OTHER is a free-text catch-all for unique scope items.",
    kinds: ["INSTALL_LABOR", "OTHER"],
  },
];

/**
 * /pricing — public-to-staff pricing catalog browser.
 *
 * Shows every bundle with full per-seat tier table, sub-tier includes, annual
 * add-ons, plus standalone service-line pricing. Any authenticated user can
 * view; Superadmin gets an edit link.
 */
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
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <HeroBand
        eyebrow="SERVICE CATALOG · PRICING"
        title="Bundles, sub-tiers, and standalone pricing"
        subtitle="Everything Gateway sells, in one place. Use this as the reference when you're building a quote — the Pricing card on a Lead will auto-fill the sticker from these numbers."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/help">Open help center</Link>
            </Button>
            {canEdit && (
              <Button asChild>
                <Link href="/admin/pricing">Edit catalog →</Link>
              </Button>
            )}
          </>
        }
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md">
          <IconTile Icon={Briefcase} size="lg" />
          <IconTile Icon={Shield} size="lg" />
          <IconTile Icon={Server} size="lg" />
          <IconTile Icon={Sparkles} size="lg" />
        </div>
      </HeroBand>

      <Callout kind="tip">
        Prices below come from the live catalog (<code className="gtn-code-pill">pricing.catalog</code> in SystemConfig). When you propose pricing on a lead, the portal auto-routes approvals: <strong>0–5%</strong> off MRR self-approves, <strong>5–20%</strong> goes to your Sales Manager, <strong>over 20% or below-floor</strong> goes to the COO.
      </Callout>

      {/* Bundles */}
      <section className="space-y-6">
        <h2 className="gtn-section-label">Bundles</h2>

        {bundles.map((b) => {
          const includes = bundleIncludesNormalized(b);
          const isCustom = b.id === ServiceBundle.CUSTOM;

          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gtn-navy">{b.label}</h3>
                    <Pill tone="purple" dot>{b.id.replace(/_/g, " ")}</Pill>
                  </div>
                  <p className="text-sm text-gtn-grey-2 mt-1 max-w-3xl">{b.description}</p>
                </div>
              </div>

              {/* What's included */}
              {includes.length > 0 && (
                <div className="mb-4">
                  <p className="gtn-eyebrow gtn-eyebrow--dark mb-2">What&apos;s included</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {includes.map((inc, i) => (
                      <li
                        key={`${inc.serviceLine}-${i}`}
                        className="text-[11px] bg-gtn-lavender text-gtn-navy rounded px-2 py-1"
                      >
                        <span className="font-semibold">{inc.serviceLine.replace(/_/g, " ")}</span>
                        {inc.tier && <span className="text-gtn-grey-2 ml-1">· {inc.tier}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Seat tiers */}
              {!isCustom && b.seatTiers.length > 0 ? (
                <div className="mb-4">
                  <p className="gtn-eyebrow gtn-eyebrow--dark mb-2">Per-seat monthly recurring</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
                        <tr>
                          <th className="py-2 pr-3 font-medium">Seat band</th>
                          <th className="py-2 pr-3 font-medium text-right">Sticker / seat</th>
                          <th className="py-2 pr-3 font-medium text-right">Floor / seat</th>
                          <th className="py-2 font-medium text-right">Example monthly (max band)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.seatTiers.map((t, i) => (
                          <tr key={i} className="border-b border-gtn-lavender-2 last:border-0">
                            <td className="py-2 pr-3">{t.minSeats}–{t.maxSeats} seats</td>
                            <td className="py-2 pr-3 text-right font-mono">{fmtUsd(t.perSeatMrr)}</td>
                            <td className="py-2 pr-3 text-right font-mono text-gtn-grey-2">{fmtUsd(t.perSeatFloor)}</td>
                            <td className="py-2 text-right font-mono font-semibold text-gtn-navy">{fmtUsd(t.perSeatMrr * t.maxSeats)}/mo</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : isCustom ? (
                <Callout kind="note" label="Custom">
                  Scoped per engagement. No seat-tier sticker — propose manually on the lead.
                </Callout>
              ) : null}

              {/* Onboarding */}
              {!isCustom && (
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-md bg-gtn-lavender p-3 text-sm">
                    <p className="gtn-eyebrow gtn-eyebrow--dark">One-time onboarding</p>
                    <p className="text-gtn-navy mt-1">
                      <span className="font-mono">{fmtUsd(b.onboarding.base)}</span> base{" "}
                      + <span className="font-mono">{fmtUsd(b.onboarding.perSeat)}</span>/seat
                    </p>
                  </div>
                  {b.annualAddOns && b.annualAddOns.length > 0 && (
                    <div className="rounded-md bg-gtn-lavender p-3 text-sm">
                      <p className="gtn-eyebrow gtn-eyebrow--dark">Annual add-ons</p>
                      {b.annualAddOns.map((a, i) => (
                        <p key={i} className="text-gtn-navy mt-1">
                          {a.label} <span className="font-mono">· {fmtUsd(a.amount)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </section>

      {/* Service-line sub-tiers */}
      <section className="space-y-4">
        <h2 className="gtn-section-label">Service-line sub-tiers</h2>
        <Card>
          <p className="text-sm text-gtn-grey-2 mb-4">
            Named tiers per offering — used when you compose a custom quote or want to surface what&apos;s in a bundle to the customer.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(SERVICE_LINE_TIERS).map(([line, tiers]) => (
              <div key={line} className="rounded-md border border-gtn-lavender-2 p-3">
                <p className="text-sm font-semibold text-gtn-navy">{line.replace(/_/g, " ")}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">{(tiers as string[]).join(" · ")}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Standalone */}
      <section className="space-y-4">
        <h2 className="gtn-section-label">Standalone service lines</h2>
        <Card>
          <p className="text-sm text-gtn-grey-2 mb-4">
            Per-seat MRR + one-time setup when sold line-by-line (no bundle discount). Use the bundle when 60–70% of the value comes from integration.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
                <tr>
                  <th className="py-2 pr-3 font-medium">Service line</th>
                  <th className="py-2 pr-3 font-medium text-right">Per-seat MRR</th>
                  <th className="py-2 pr-3 font-medium text-right">Floor / seat</th>
                  <th className="py-2 font-medium text-right">One-time setup</th>
                </tr>
              </thead>
              <tbody>
                {standaloneEntries.map(([line, entry]) => (
                  <tr key={line} className="border-b border-gtn-lavender-2 last:border-0">
                    <td className="py-2 pr-3 font-medium text-gtn-navy">{line.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {entry.perSeatMrr > 0 ? fmtUsd(entry.perSeatMrr) : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-gtn-grey-2">
                      {entry.perSeatFloor > 0 ? fmtUsd(entry.perSeatFloor) : "—"}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {entry.oneTime > 0 ? fmtUsd(entry.oneTime) : "scoped"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* v2.18 — Deal kinds + per-unit pricing for project-style deals */}
      <section className="space-y-4">
        <h2 className="gtn-section-label">Deal types</h2>
        <Card>
          <p className="text-sm text-gtn-grey-2 mb-4">
            What kind of deal is this? Each kind drives the PricingCard form
            (bundles vs. line-item quote builder) and the onboarding
            template stack that materializes after the COO accepts the handoff.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {listDealKinds().map((dk) => (
              <div key={dk.kind} className="rounded-md border border-gtn-lavender-2 p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gtn-navy">{dk.label}</p>
                  {dk.usesBundles ? (
                    <Pill tone="purple" dot>Bundles</Pill>
                  ) : (
                    <Pill tone="navy" dot>Line-item quote</Pill>
                  )}
                </div>
                <p className="text-xs text-gtn-grey-2">{dk.tagline}</p>
                {dk.serviceLines.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dk.serviceLines.map((sl) => (
                      <span
                        key={sl}
                        className="text-[10px] bg-gtn-lavender text-gtn-navy rounded px-1.5 py-0.5"
                      >
                        {sl.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="gtn-section-label">Per-unit pricing (project-style deals)</h2>
        <Card>
          <p className="text-sm text-gtn-grey-2 mb-4">
            When the deal kind is voice, cabling, access control, video, or
            a custom mix, the salesperson builds the quote line-by-line
            from these stickers. The pre-sale assessment scoring engines
            output recommended line items at these prices &mdash; one click
            adopts them into the quote.
          </p>
          {LINE_ITEM_GROUPS.map((group) => (
            <div key={group.label} className="mt-4 first:mt-0">
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <p className="text-sm font-semibold text-gtn-navy">{group.label}</p>
                <p className="text-xs text-gtn-grey-2 max-w-md text-right">{group.help}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Line item</th>
                      <th className="py-2 pr-3 font-medium text-right">MRR each</th>
                      <th className="py-2 pr-3 font-medium text-right">One-time each</th>
                      <th className="py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kinds.map((kind) => {
                      const s = LINE_ITEM_STICKERS[kind];
                      return (
                        <tr key={kind} className="border-b border-gtn-lavender-2 last:border-0 align-top">
                          <td className="py-2 pr-3 font-medium text-gtn-navy whitespace-nowrap">
                            {s.label}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {s.perUnitMrr > 0 ? fmtUsd(s.perUnitMrr) : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {s.perUnitOneTime > 0 ? fmtUsd(s.perUnitOneTime) : "—"}
                          </td>
                          <td className="py-2 text-xs text-gtn-grey-2">{s.helpText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <Callout kind="tip" label="Sticker, not floor">
            These are the catalog stickers. The Salesperson can override per
            quote (within the same approval-tier math: 0&ndash;5% self-approves,
            5&ndash;20% Sales Manager, 20%+ or below-floor &rarr; COO).
            Sales Manager + Superadmin can edit these defaults from{" "}
            <Link href="/admin/pricing" className="text-gtn-purple hover:underline">
              /admin/pricing
            </Link>.
          </Callout>
        </Card>
      </section>

      {/* v2.18 — pre-sale assessment quick reference */}
      <section className="space-y-4">
        <h2 className="gtn-section-label">Pre-sale scoping (vCIO)</h2>
        <Card>
          <p className="text-sm text-gtn-grey-2 mb-3">
            Salesperson can request vCIO scoping help <strong>before</strong> the
            deal closes &mdash; right from the lead detail page. The vCIO
            answers a focused ~25-question bank and the scoring engine
            outputs recommended line items at the prices above.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { key: "VOICE_SCOPING", label: "Voice / Phone scoping", desc: "Extensions, port-out, hardware, network readiness, special needs (e911, recording, CRM)." },
              { key: "CCTV_SCOPING", label: "CCTV / Video scoping", desc: "Camera count, retention, NVR sizing, PoE budget, remote viewing." },
              { key: "ACCESS_CONTROL_SCOPING", label: "Access control scoping", desc: "Door count + type, credentials, software, compliance drivers." },
              { key: "SITE_SURVEY", label: "IT Site Survey (full)", desc: "Deep IT discovery for managed-IT bundle deals: identity, endpoints, backups, compliance." },
            ].map((s) => (
              <div key={s.key} className="rounded-md border border-gtn-lavender-2 p-3">
                <p className="text-sm font-semibold text-gtn-navy">{s.label}</p>
                <p className="text-xs text-gtn-grey-2 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <p className="text-xs text-gtn-grey-3">
          Catalog version: <code className="gtn-code-pill">{catalog.version}</code> · currency {catalog.currency}.
          {/* v2.18 — DEAL_KIND_META is part of the type registry; bumping a deal kind
              here cross-references the catalog version. */}
          {" "}Deal-kind registry: <code className="gtn-code-pill">{Object.keys(DEAL_KIND_META).length} kinds</code>.
        </p>
      </Card>
    </div>
  );
}
