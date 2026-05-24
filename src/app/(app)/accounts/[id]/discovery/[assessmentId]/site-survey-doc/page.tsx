import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { bankForKind, discoveryTitle } from "@/lib/discovery/banks";
import { PrintableForm } from "@/components/print/PrintableForm";
import { extractTopology } from "@/lib/topology/extractor";
import { layoutToSvg } from "@/lib/topology/svgLayout";
import type { DiscoveryQuestion } from "@/lib/discovery/types";

export const dynamic = "force-dynamic";

/**
 * v2.23 — "Beautiful site survey document".
 *
 * Renders one customer-presentable document that includes:
 *   - Cover (customer, site list, kind, completion date, who ran it)
 *   - AI plan executive summary + customer next step
 *   - Scorecard at a glance (findings / risks / recommended actions)
 *   - Every populated inventory asset table
 *   - Programmatic network map (SVG, no LLM)
 *   - Recommended next steps grouped by phase
 *   - Raw assessment answers grouped by section (for reference)
 */
export default async function SiteSurveyDocPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, assessmentId } = await params;

  const assessment = await prisma.discoveryAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      customer: {
        include: {
          lead: { select: { businessName: true, ownerUserId: true } },
          sites: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }], select: { id: true, name: true, address: true, city: true, state: true, isPrimary: true } },
        },
      },
      createdBy: { select: { name: true } },
      planAcceptedBy: { select: { name: true } },
    },
  });
  if (!assessment || !assessment.customer || assessment.customerId !== id) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, assessment.customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const customer = assessment.customer;
  const bank = bankForKind(assessment.kind);
  const title = discoveryTitle(assessment.kind);
  const answers = (assessment.answers as Record<string, unknown>) ?? {};
  const scorecard = assessment.scorecard as
    | { summary?: string; findings?: string[]; risks?: Array<{ severity?: string; description?: string }>; recommendedActions?: string[] }
    | null;
  const plan = assessment.planAcceptedSnapshot ?? assessment.aiPlanSnapshot;
  const planObj = plan as
    | {
        summary?: string;
        recommendedTasks?: Array<{ phase?: string; title?: string; description?: string; ownerRole?: string; priority?: string; dueOffsetDays?: number; sourceFinding?: string }>;
        customerNextStep?: string;
        risks?: Array<{ severity?: string; description?: string }>;
        recommendedServices?: Array<{ serviceLine?: string; why?: string }>;
      }
    | null;

  // Pull inventory + topology in parallel
  const [firewalls, switches, aps, servers, storage, circuits, endpoints, licenses, vendors, topology] = await Promise.all([
    prisma.firewallAsset.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, model: true, serialNumber: true, firmwareVersion: true, eolDate: true } }),
    prisma.switchAsset.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, model: true, portCount: true, mgmtIp: true, isStacked: true } }),
    prisma.accessPoint.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, model: true, count: true } }),
    prisma.serverAsset.findMany({ where: { customerId: id }, orderBy: { hostname: "asc" }, select: { id: true, hostname: true, role: true, osVersion: true, virtual: true, cpuCores: true, ramGb: true } }),
    prisma.storageAsset.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, model: true, type: true, capacityTb: true, backupTarget: true } }),
    prisma.networkCircuit.findMany({ where: { customerId: id }, orderBy: { provider: "asc" }, select: { id: true, provider: true, type: true, bandwidthDown: true, bandwidthUp: true, monthlyCost: true, isFailover: true } }),
    prisma.endpointSummary.findMany({ where: { customerId: id }, orderBy: { createdAt: "asc" }, select: { id: true, count: true, avgAgeMonths: true } }),
    prisma.licenseEntry.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, product: true, seats: true, renewalDate: true, type: true } }),
    prisma.vendorContract.findMany({ where: { customerId: id }, orderBy: { vendor: "asc" }, select: { id: true, vendor: true, service: true, monthlyCost: true, contractEnd: true } }),
    extractTopology(id),
  ]);

  const networkSvg = layoutToSvg(topology);

  // Group questions by section for the appendix
  const bySection = new Map<string, DiscoveryQuestion[]>();
  for (const q of bank.questions) {
    if (!bySection.has(q.section)) bySection.set(q.section, []);
    bySection.get(q.section)!.push(q);
  }

  const totalEndpoints = endpoints.reduce((s, e) => s + (e.count ?? 0), 0);

  return (
    <PrintableForm title="Site Survey Report" subtitle={customer.lead.businessName}>
      <div className="space-y-8 text-sm">
        {/* COVER */}
        <section className="border-b border-gtn-lavender-2 pb-4">
          <h1 className="text-3xl font-bold text-gtn-navy">{customer.lead.businessName}</h1>
          <p className="text-sm text-gtn-grey-2 mt-1">{title}</p>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-4 text-xs">
            <div><dt className="inline font-semibold text-gtn-grey-2">Completed:</dt> <dd className="inline">{assessment.completedAt ? format(assessment.completedAt, "PP") : "—"}</dd></div>
            <div><dt className="inline font-semibold text-gtn-grey-2">Conducted by:</dt> <dd className="inline">{assessment.createdBy.name}</dd></div>
            {assessment.planAcceptedAt && (
              <>
                <div><dt className="inline font-semibold text-gtn-grey-2">Plan accepted:</dt> <dd className="inline">{format(assessment.planAcceptedAt, "PP")}</dd></div>
                <div><dt className="inline font-semibold text-gtn-grey-2">Accepted by:</dt> <dd className="inline">{assessment.planAcceptedBy?.name ?? "—"}</dd></div>
              </>
            )}
          </dl>
          {customer.sites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gtn-grey-2">Sites</p>
              <ul className="text-xs mt-1 space-y-0.5">
                {customer.sites.map((s) => (
                  <li key={s.id}>
                    {s.isPrimary && <span className="text-[10px] uppercase font-bold tracking-wide text-gtn-purple mr-1">[primary]</span>}
                    <strong>{s.name}</strong>
                    {s.address && ` — ${s.address}`}
                    {(s.city || s.state) && `, ${[s.city, s.state].filter(Boolean).join(", ")}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* EXECUTIVE SUMMARY */}
        {planObj?.summary && (
          <section>
            <h2 className="text-lg font-semibold text-gtn-navy mb-2">Executive summary</h2>
            <p className="text-sm whitespace-pre-wrap">{planObj.summary}</p>
            {planObj.customerNextStep && (
              <p className="mt-3 text-sm italic text-gtn-purple">→ {planObj.customerNextStep}</p>
            )}
          </section>
        )}

        {/* SCORECARD */}
        {scorecard && (scorecard.findings?.length || scorecard.risks?.length || scorecard.recommendedActions?.length) && (
          <section>
            <h2 className="text-lg font-semibold text-gtn-navy mb-2">Findings & risks</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-xs">
              {scorecard.findings && scorecard.findings.length > 0 && (
                <div>
                  <p className="font-semibold text-gtn-navy mb-1">Findings</p>
                  <ul className="list-disc list-inside space-y-1">
                    {scorecard.findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {scorecard.risks && scorecard.risks.length > 0 && (
                <div>
                  <p className="font-semibold text-gtn-red mb-1">Risks</p>
                  <ul className="list-disc list-inside space-y-1">
                    {scorecard.risks.map((r, i) => (
                      <li key={i}>
                        {r.severity && <span className="text-[10px] font-bold uppercase mr-1">[{r.severity}]</span>}
                        {r.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scorecard.recommendedActions && scorecard.recommendedActions.length > 0 && (
                <div>
                  <p className="font-semibold text-gtn-purple mb-1">Recommended actions</p>
                  <ul className="list-disc list-inside space-y-1">
                    {scorecard.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* INVENTORY TABLES */}
        <section className="page-break-before">
          <h2 className="text-lg font-semibold text-gtn-navy mb-3">Inventory</h2>

          <InventoryTable title="Network circuits" rows={circuits.map((c) => [c.provider, String(c.type), c.bandwidthDown ? `${c.bandwidthDown}↓ / ${c.bandwidthUp ?? "?"}↑ Mbps` : "—", c.monthlyCost ? `$${Number(c.monthlyCost).toFixed(0)}/mo` : "—", c.isFailover ? "failover" : "primary"])} headers={["Provider", "Type", "Bandwidth", "Cost", "Role"]} />

          <InventoryTable title="Firewalls" rows={firewalls.map((f) => [f.vendor, f.model ?? "—", f.serialNumber ?? "—", f.firmwareVersion ?? "—", f.eolDate ? format(f.eolDate, "PP") : "—"])} headers={["Vendor", "Model", "Serial", "Firmware", "EOL"]} />

          <InventoryTable title="Switches" rows={switches.map((s) => [s.vendor, s.model ?? "—", s.portCount ? `${s.portCount}p` : "—", s.mgmtIp ?? "—", s.isStacked ? "yes" : "no"])} headers={["Vendor", "Model", "Ports", "Mgmt IP", "Stacked"]} />

          <InventoryTable title="Access points" rows={aps.map((a) => [a.vendor, a.model ?? "—", String(a.count)])} headers={["Vendor", "Model", "Count"]} />

          <InventoryTable title="Servers" rows={servers.map((s) => [s.hostname, s.role ?? "—", s.osVersion ?? "—", s.virtual ? "VM" : "Physical", s.cpuCores ? `${s.cpuCores} core / ${s.ramGb ?? "?"} GB` : "—"])} headers={["Hostname", "Role", "OS", "Type", "CPU/RAM"]} />

          <InventoryTable title="Storage" rows={storage.map((s) => [s.vendor, s.model ?? "—", String(s.type), s.capacityTb ? `${Number(s.capacityTb).toFixed(0)} TB` : "—", s.backupTarget ? "yes" : "no"])} headers={["Vendor", "Model", "Type", "Capacity", "Backup"]} />

          {totalEndpoints > 0 && (
            <InventoryTable title="Endpoints" rows={endpoints.map((e) => [String(e.count), e.avgAgeMonths ? `${e.avgAgeMonths} mo avg` : "—"])} headers={["Count", "Avg age"]} />
          )}

          <InventoryTable title="Licenses" rows={licenses.map((l) => [l.vendor, l.product, l.seats ? String(l.seats) : "—", l.type ? String(l.type) : "—", l.renewalDate ? format(l.renewalDate, "PP") : "—"])} headers={["Vendor", "Product", "Seats", "Type", "Renewal"]} />

          <InventoryTable title="Vendor contracts" rows={vendors.map((v) => [v.vendor, v.service ?? "—", v.monthlyCost ? `$${Number(v.monthlyCost).toFixed(0)}/mo` : "—", v.contractEnd ? format(v.contractEnd, "PP") : "—"])} headers={["Vendor", "Service", "Cost", "Contract end"]} />
        </section>

        {/* NETWORK MAP */}
        {topology.nodes.length > 0 && (
          <section className="page-break-before">
            <h2 className="text-lg font-semibold text-gtn-navy mb-2">Network topology</h2>
            <p className="text-xs text-gtn-grey-2 mb-3">
              Programmatically derived from the inventory above. Not drawn by AI — straight from the captured data.
              Extracted {format(new Date(topology.extractedAt), "PPp")}.
            </p>
            <div
              className="border border-gtn-lavender-2 rounded bg-white p-2"
              // SVG string from our deterministic layout; safe (no user input)
              dangerouslySetInnerHTML={{ __html: networkSvg }}
            />
          </section>
        )}

        {/* RECOMMENDED NEXT STEPS */}
        {planObj?.recommendedTasks && planObj.recommendedTasks.length > 0 && (
          <section className="page-break-before">
            <h2 className="text-lg font-semibold text-gtn-navy mb-3">Recommended next steps</h2>
            {(["PRE_ENGAGEMENT", "DISCOVERY", "ONBOARD", "STABILIZE", "STEADY_STATE"] as const).map((phase) => {
              const items = planObj.recommendedTasks!.filter((t) => t.phase === phase);
              if (items.length === 0) return null;
              return (
                <div key={phase} className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gtn-purple">{phase.replace(/_/g, " ")}</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {items.map((t, i) => (
                      <li key={i}>
                        <strong>{t.title}</strong>
                        {t.ownerRole && <span className="text-gtn-grey-2"> · owner: {String(t.ownerRole)}</span>}
                        {typeof t.dueOffsetDays === "number" && <span className="text-gtn-grey-2"> · due day {t.dueOffsetDays}</span>}
                        {t.priority && <span className="text-gtn-grey-2"> · {t.priority}</span>}
                        {t.description && <p className="mt-0.5 ml-2 text-gtn-grey-2">{t.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        )}

        {/* RAW ANSWERS APPENDIX */}
        <section className="page-break-before">
          <h2 className="text-lg font-semibold text-gtn-navy mb-3">Survey answers</h2>
          {Array.from(bySection.entries()).map(([sectionName, qs]) => (
            <div key={sectionName} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gtn-grey-2">{sectionName}</p>
              <ul className="mt-1 space-y-1 text-xs">
                {qs.map((q) => {
                  const v = answers[q.id];
                  const display =
                    v == null || v === "" || (Array.isArray(v) && v.length === 0)
                      ? "—"
                      : Array.isArray(v)
                        ? v.join(", ")
                        : typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v);
                  return (
                    <li key={q.id}>
                      <span className="text-gtn-grey-2">{q.prompt}</span>{" "}
                      <strong className="text-gtn-navy">{display}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>

      <style>{`
        @media print {
          .page-break-before { page-break-before: always; }
        }
      `}</style>
    </PrintableForm>
  );
}

function InventoryTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gtn-grey-2 mb-1">{title} ({rows.length})</p>
      <table className="w-full text-xs border border-gtn-lavender-2">
        <thead className="bg-gtn-lavender text-gtn-navy">
          <tr>{headers.map((h, i) => <th key={i} className="text-left px-2 py-1 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-gtn-lavender-2">
              {r.map((c, ci) => <td key={ci} className="px-2 py-1">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
