import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { PrintableForm } from "@/components/print/PrintableForm";

type Stake = { name?: string; role?: string; authority?: string; temperature?: string; comms?: string };
type Commit = { text?: string; sowRef?: string; deadline?: string };
type Objection = { name?: string; concern?: string; status?: string };
type Success = { metric?: string; target?: string; owner?: string };
type Budget = { status?: string; range?: string; notes?: string };

export default async function HandoffPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      handoffs: { orderBy: { createdAt: "desc" }, take: 1, include: { initiator: true, acceptor: true } },
    },
  });
  if (!lead) notFound();
  if (lead.ownerUserId !== session.user.id && !can(session.user.role, "lead:view:all")) {
    redirect(`/leads/${id}`);
  }
  const h = lead.handoffs[0];

  const dms = (h?.decisionMakers ?? []) as Stake[];
  const hard = (h?.hardCommitments ?? []) as Commit[];
  const soft = (h?.softCommitments ?? []) as Commit[];
  const objs = (h?.objectionsAndSkeptics ?? []) as Objection[];
  const success = (h?.successCriteria ?? []) as Success[];
  const budget = (h?.budgetSnapshot ?? null) as Budget | null;

  return (
    <PrintableForm
      title="Sales-to-Ops Handoff"
      subtitle={`${lead.businessName} · ${h ? format(new Date(h.createdAt), "PPP") : "draft"}`}
    >
      <div className="space-y-5 text-sm">
        <Section title="Customer">
          <Row label="Business">{lead.businessName}</Row>
          <Row label="Industry">{lead.industry.replace(/_/g, " ")}</Row>
          <Row label="Seats / sites">{lead.seatCount ?? "—"} seats · {lead.siteCount} site{lead.siteCount === 1 ? "" : "s"}</Row>
          <Row label="Primary contact">
            {lead.primaryContactName ?? "—"} · {lead.primaryContactTitle ?? "—"} · {lead.primaryContactEmail ?? "—"} · {lead.primaryContactPhone ?? "—"}
          </Row>
          <Row label="Salesperson">{lead.owner.name} · {lead.owner.email}</Row>
        </Section>

        <Section title="Deal facts">
          <Row label="Deal value">{h?.dealValue ? `$${Number(h.dealValue).toLocaleString()}` : "—"}</Row>
          <Row label="Bundle">{h?.bundleId?.replace(/_/g, " ") ?? "—"}</Row>
          <Row label="Compliance overlay">{(h?.complianceOverlay ?? []).join(", ") || "—"}</Row>
          <Row label="Contracts signed">{(h?.contractsSigned ?? []).join(", ") || "—"}</Row>
        </Section>

        <Section title="Decision makers">
          {dms.length === 0 ? <p className="text-gtn-grey-2">—</p> : (
            <table className="w-full text-xs">
              <thead className="text-left text-gtn-grey-2 border-b border-gtn-lavender-2">
                <tr><th className="py-1.5">Name</th><th>Role</th><th>Authority</th><th>Temperature</th></tr>
              </thead>
              <tbody>
                {dms.map((d, i) => (
                  <tr key={i} className="border-b border-gtn-lavender-2">
                    <td className="py-1.5 font-medium">{d.name ?? "—"}</td>
                    <td>{d.role ?? "—"}</td>
                    <td>{d.authority ?? "—"}</td>
                    <td>{d.temperature ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {h?.stakeholderContext && <p className="text-xs text-gtn-grey-2 mt-2 whitespace-pre-wrap">{h.stakeholderContext}</p>}
        </Section>

        <Section title="Hard commitments (in SOW)">
          {hard.length === 0 ? <p className="text-gtn-grey-2">—</p> : (
            <ul className="list-disc pl-5 space-y-1">
              {hard.map((c, i) => (
                <li key={i}>{c.text}{c.sowRef ? ` (${c.sowRef})` : ""}{c.deadline ? ` · due ${c.deadline}` : ""}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Soft commitments">
          {soft.length === 0 ? <p className="text-gtn-grey-2">—</p> : (
            <ul className="list-disc pl-5 space-y-1">
              {soft.map((c, i) => (
                <li key={i}>{c.text}{c.deadline ? ` · ${c.deadline}` : ""}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Objections + skeptics">
          {objs.length === 0 ? <p className="text-gtn-grey-2">—</p> : (
            <ul className="list-disc pl-5 space-y-1">
              {objs.map((o, i) => (
                <li key={i}>{o.name ? `${o.name}: ` : ""}{o.concern}{o.status ? ` (${o.status})` : ""}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Budget snapshot">
          {!budget ? <p className="text-gtn-grey-2">—</p> : (
            <>
              <Row label="Status">{budget.status ?? "—"}</Row>
              <Row label="Range">{budget.range ?? "—"}</Row>
              {budget.notes && <p className="text-xs text-gtn-grey-2 mt-1 whitespace-pre-wrap">{budget.notes}</p>}
            </>
          )}
        </Section>

        <Section title="Success criteria">
          {success.length === 0 ? <p className="text-gtn-grey-2">—</p> : (
            <ul className="list-disc pl-5 space-y-1">
              {success.map((s, i) => (
                <li key={i}>{s.metric}{s.target ? ` → ${s.target}` : ""}{s.owner ? ` · owner: ${s.owner}` : ""}</li>
              ))}
            </ul>
          )}
        </Section>

        {h?.notes && (
          <Section title="Notes to Ops">
            <p className="text-xs whitespace-pre-wrap">{h.notes}</p>
          </Section>
        )}
      </div>
    </PrintableForm>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="text-sm font-semibold text-gtn-navy uppercase tracking-wide border-b border-gtn-lavender-2 pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-xs py-0.5">
      <p className="w-40 text-gtn-grey-2 flex-shrink-0">{label}</p>
      <p className="flex-1">{children}</p>
    </div>
  );
}
