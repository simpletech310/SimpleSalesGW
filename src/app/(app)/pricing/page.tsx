import { redirect } from "next/navigation";
import Link from "next/link";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/brand";
import { DashboardPage, DashboardSection } from "@/components/templates";
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

const LINE_ITEM_GROUPS: ReadonlyArray<{ label: string; help: string; kinds: ReadonlyArray<LineItemKind> }> = [
  { label: "Voice / Phone system",  help: "Per-extension MRR plus handset hardware. Used in Voice-only and Voice+Video deals.", kinds: ["VOICE_EXTENSION", "VOICE_HARDWARE"] },
  { label: "Structured cabling",    help: "Per-drop pricing for new cable runs (Cat6 / Cat6a, terminated and certified).",      kinds: ["CABLE_DROP"] },
  { label: "Access control",        help: "Per-door reader + software licensing. Door hardware priced separately.",              kinds: ["DOOR_READER"] },
  { label: "Video surveillance",    help: "Per-camera MRR for monitoring + per-camera one-time install.",                        kinds: ["CAMERA", "NVR_DVR"] },
  { label: "Labor + catch-all",     help: "Technician hours for installs and ad-hoc work. OTHER is a free-text catch-all.",      kinds: ["INSTALL_LABOR", "OTHER"] },
];

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
      title="Bundles, sub-tiers, and standalone pricing"
      subtitle="Everything Gateway sells, in one place. Use this as the reference when you're building a quote — the Pricing card on a Lead auto-fills the sticker from these numbers."
      actions={
        <>
          <Button asChild variant="secondary" size="sm">
            <Link href="/help">Open help center</Link>
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

      {/* Bundles */}
      <DashboardSection title="Bundles">
        <div className="space-y-4">
          {bundles.map((b) => {
            const includes = bundleIncludesNormalized(b);
            const isCustom = b.id === ServiceBundle.CUSTOM;
            return (
              <div key={b.id} className="rounded-xl border border-line-subtle bg-surface-2 p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-ink-strong">{b.label}</h3>
                      <Badge tone="brand" shape="pill" size="xs" dot>{b.id.replace(/_/g, " ").toLowerCase()}</Badge>
                    </div>
                    <p className="text-sm text-ink-muted mt-1 max-w-3xl">{b.description}</p>
                  </div>
                </div>

                {includes.length > 0 && (
                  <div className="mb-4">
                    <p className="ui-label mb-2">What&apos;s included</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {includes.map((inc, i) => (
                        <li key={`${inc.serviceLine}-${i}`} className="text-[11px] bg-brand-soft text-gtn-navy rounded px-2 py-1">
                          <span className="font-semibold">{inc.serviceLine.replace(/_/g, " ")}</span>
                          {inc.tier && <span className="text-ink-muted ml-1">· {inc.tier}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!isCustom && b.seatTiers.length > 0 ? (
                  <div className="mb-4">
                    <p className="ui-label mb-2">Per-seat monthly recurring</p>
                    <div className="overflow-x-auto rounded-lg border border-line-subtle bg-surface">
                      <table className="w-full text-sm">
                        <thead className="bg-surface-2 text-left">
                          <tr className="text-ink-muted">
                            <th className="ui-label px-3 py-2">Seat band</th>
                            <th className="ui-label px-3 py-2 text-right">Sticker / seat</th>
                            <th className="ui-label px-3 py-2 text-right">Floor / seat</th>
                            <th className="ui-label px-3 py-2 text-right">Example (max band)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.seatTiers.map((t, i) => (
                            <tr key={i} className="border-t border-line-subtle">
                              <td className="px-3 py-2">{t.minSeats}–{t.maxSeats} seats</td>
                              <td className="px-3 py-2 text-right font-mono tabular">{fmtUsd(t.perSeatMrr)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular text-ink-muted">{fmtUsd(t.perSeatFloor)}</td>
                              <td className="px-3 py-2 text-right font-mono tabular font-semibold text-ink-strong">
                                {fmtUsd(t.perSeatMrr * t.maxSeats)}/mo
                              </td>
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

                {!isCustom && (
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div className="rounded-lg bg-brand-soft p-3 text-sm">
                      <p className="ui-label">One-time onboarding</p>
                      <p className="text-ink-strong mt-1">
                        <span className="font-mono tabular">{fmtUsd(b.onboarding.base)}</span> base{" "}
                        + <span className="font-mono tabular">{fmtUsd(b.onboarding.perSeat)}</span>/seat
                      </p>
                    </div>
                    {b.annualAddOns && b.annualAddOns.length > 0 && (
                      <div className="rounded-lg bg-brand-soft p-3 text-sm">
                        <p className="ui-label">Annual add-ons</p>
                        {b.annualAddOns.map((a, i) => (
                          <p key={i} className="text-ink-strong mt-1">
                            {a.label} <span className="font-mono tabular">· {fmtUsd(a.amount)}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DashboardSection>

      {/* Sub-tiers */}
      <DashboardSection title="Service-line sub-tiers" subtitle="Named tiers per offering — used when composing a custom quote.">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {Object.entries(SERVICE_LINE_TIERS).map(([line, tiers]) => (
            <div key={line} className="rounded-lg border border-line-subtle p-3 bg-surface-2">
              <p className="text-sm font-semibold text-ink-strong">{line.replace(/_/g, " ")}</p>
              <p className="text-xs text-ink-muted mt-1">{(tiers as string[]).join(" · ")}</p>
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Standalone */}
      <DashboardSection
        title="Standalone service lines"
        subtitle="Per-seat MRR + one-time setup when sold line-by-line (no bundle discount). Use a bundle when 60–70% of the value comes from integration."
      >
        <div className="overflow-x-auto rounded-lg border border-line-subtle bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left">
              <tr>
                <th className="ui-label px-3 py-2">Service line</th>
                <th className="ui-label px-3 py-2 text-right">Per-seat MRR</th>
                <th className="ui-label px-3 py-2 text-right">Floor / seat</th>
                <th className="ui-label px-3 py-2 text-right">One-time setup</th>
              </tr>
            </thead>
            <tbody>
              {standaloneEntries.map(([line, entry]) => (
                <tr key={line} className="border-t border-line-subtle">
                  <td className="px-3 py-2 font-medium text-ink-strong">{line.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-right font-mono tabular">{entry.perSeatMrr > 0 ? fmtUsd(entry.perSeatMrr) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular text-ink-muted">{entry.perSeatFloor > 0 ? fmtUsd(entry.perSeatFloor) : "—"}</td>
                  <td className="px-3 py-2 text-right font-mono tabular">{entry.oneTime > 0 ? fmtUsd(entry.oneTime) : "scoped"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      {/* Deal kinds */}
      <DashboardSection title="Deal types" subtitle="Drives the PricingCard form and the onboarding template stack after handoff acceptance.">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {listDealKinds().map((dk) => (
            <div key={dk.kind} className="rounded-lg border border-line-subtle p-3 bg-surface-2">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-ink-strong">{dk.label}</p>
                {dk.usesBundles ? (
                  <Badge tone="brand" shape="pill" size="xs" dot>Bundles</Badge>
                ) : (
                  <Badge tone="navy" shape="pill" size="xs" dot>Line-item quote</Badge>
                )}
              </div>
              <p className="text-xs text-ink-muted">{dk.tagline}</p>
              {dk.serviceLines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {dk.serviceLines.map((sl) => (
                    <span key={sl} className="text-[10px] bg-brand-soft text-gtn-navy rounded px-1.5 py-0.5">
                      {sl.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* Per-unit pricing */}
      <DashboardSection
        title="Per-unit pricing (project-style deals)"
        subtitle="Voice, cabling, access, video, or custom mix — the salesperson builds the quote line-by-line from these stickers."
      >
        <div className="space-y-5">
          {LINE_ITEM_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <p className="text-sm font-semibold text-ink-strong">{group.label}</p>
                <p className="text-xs text-ink-muted max-w-md text-right">{group.help}</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-line-subtle bg-surface">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="bg-surface-2 text-left">
                    <tr>
                      <th className="ui-label px-3 py-2">Line item</th>
                      <th className="ui-label px-3 py-2 text-right">MRR each</th>
                      <th className="ui-label px-3 py-2 text-right">One-time each</th>
                      <th className="ui-label px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.kinds.map((kind) => {
                      const s = LINE_ITEM_STICKERS[kind];
                      return (
                        <tr key={kind} className="border-t border-line-subtle align-top">
                          <td className="px-3 py-2 font-medium text-ink-strong whitespace-nowrap">{s.label}</td>
                          <td className="px-3 py-2 text-right font-mono tabular">{s.perUnitMrr > 0 ? fmtUsd(s.perUnitMrr) : "—"}</td>
                          <td className="px-3 py-2 text-right font-mono tabular">{s.perUnitOneTime > 0 ? fmtUsd(s.perUnitOneTime) : "—"}</td>
                          <td className="px-3 py-2 text-xs text-ink-muted">{s.helpText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <Callout kind="tip" label="Sticker, not floor">
            These are the catalog stickers. The Salesperson can override per quote (within the approval-tier math: 0–5% self-approves, 5–20% Sales Manager, 20%+ or below-floor → COO). Sales Manager + Superadmin can edit defaults from{" "}
            <Link href="/admin/pricing" className="text-gtn-purple hover:underline font-medium">/admin/pricing</Link>.
          </Callout>
        </div>
      </DashboardSection>

      <DashboardSection title="Pre-sale scoping (vCIO)" subtitle="Salesperson can request vCIO scoping help before the deal closes — right from the lead detail page.">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {[
            { key: "VOICE_SCOPING",          label: "Voice / Phone scoping",     desc: "Extensions, port-out, hardware, network readiness, special needs (e911, recording, CRM)." },
            { key: "CCTV_SCOPING",           label: "CCTV / Video scoping",       desc: "Camera count, retention, NVR sizing, PoE budget, remote viewing." },
            { key: "ACCESS_CONTROL_SCOPING", label: "Access control scoping",     desc: "Door count + type, credentials, software, compliance drivers." },
            { key: "SITE_SURVEY",            label: "IT Site Survey (full)",      desc: "Deep IT discovery for managed-IT bundle deals: identity, endpoints, backups, compliance." },
          ].map((s) => (
            <div key={s.key} className="rounded-lg border border-line-subtle p-3 bg-surface-2">
              <p className="text-sm font-semibold text-ink-strong">{s.label}</p>
              <p className="text-xs text-ink-muted mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </DashboardSection>

      <p className="text-xs text-ink-faint text-center">
        Catalog version: <code className="gtn-code-pill">{catalog.version}</code> · currency {catalog.currency}
        {" · "}Deal-kind registry: <code className="gtn-code-pill">{Object.keys(DEAL_KIND_META).length} kinds</code>
      </p>
    </DashboardPage>
  );
}
