import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadProfile } from "@/lib/msp/loader";

/**
 * v3.3 — Print-ready proposal page. Designed for browser-side
 * "Save as PDF" or for downstream server-side rendering to blob.
 */
export const dynamic = "force-dynamic";

export default async function ProposalPrintPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { proposalId } = await params;

  const [proposal, profile] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        lead: {
          select: {
            businessName: true,
            primaryContactName: true,
            primaryContactTitle: true,
            primaryContactEmail: true,
            addressStreet: true,
            addressCity: true,
            addressState: true,
            addressZip: true,
          },
        },
      },
    }),
    loadProfile(),
  ]);
  if (!proposal) notFound();

  const pricing = proposal.pricingSnapshot as {
    proposedPriceMrr?: number;
    proposedPriceOneTime?: number;
    bundle?: string;
  } | null;

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 bg-white text-black print:px-0 print:py-0">
      <header className="border-b border-gray-300 pb-6 mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{profile.companyName}</h1>
            <p className="text-sm text-gray-600 mt-1">{profile.tagline}</p>
            <p className="text-xs text-gray-500 mt-2">{profile.location}</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p className="font-semibold text-gray-700">Statement of Work</p>
            <p>Version {proposal.version}</p>
            <p>{new Date(proposal.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Prepared for</h2>
        <p className="text-lg font-semibold">{proposal.lead.businessName}</p>
        {proposal.lead.primaryContactName && (
          <p className="text-sm">
            {proposal.lead.primaryContactName}
            {proposal.lead.primaryContactTitle && `, ${proposal.lead.primaryContactTitle}`}
          </p>
        )}
        {proposal.lead.primaryContactEmail && (
          <p className="text-sm text-gray-600">{proposal.lead.primaryContactEmail}</p>
        )}
        {(proposal.lead.addressStreet || proposal.lead.addressCity) && (
          <p className="text-sm text-gray-600 mt-1">
            {[proposal.lead.addressStreet, proposal.lead.addressCity, proposal.lead.addressState, proposal.lead.addressZip]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </section>

      {pricing && (pricing.proposedPriceMrr || pricing.proposedPriceOneTime) && (
        <section className="mb-8 rounded-lg border border-gray-300 p-4 bg-gray-50">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Investment summary</h2>
          <div className="grid grid-cols-2 gap-4">
            {pricing.proposedPriceMrr ? (
              <div>
                <p className="text-xs text-gray-500">Monthly (MRR)</p>
                <p className="text-xl font-bold">${pricing.proposedPriceMrr.toLocaleString()}</p>
              </div>
            ) : null}
            {pricing.proposedPriceOneTime ? (
              <div>
                <p className="text-xs text-gray-500">One-time onboarding</p>
                <p className="text-xl font-bold">${pricing.proposedPriceOneTime.toLocaleString()}</p>
              </div>
            ) : null}
          </div>
          {pricing.bundle && <p className="text-xs text-gray-600 mt-2">Bundle: {pricing.bundle.replace(/_/g, " ")}</p>}
        </section>
      )}

      <Section title="Scope" markdown={proposal.scopeMarkdown} />
      <Section title="Deliverables" markdown={proposal.deliverablesMarkdown} />
      <Section title="Timeline" markdown={proposal.timelineMarkdown} />
      <Section title="Exclusions" markdown={proposal.exclusionsMarkdown} />
      <Section title="Terms" markdown={proposal.termsMarkdown} />

      <footer className="mt-12 pt-6 border-t border-gray-300 text-xs text-gray-500">
        <p>{profile.companyName} · {profile.location}</p>
        <p>Document ID: {proposal.id} · Version {proposal.version}</p>
      </footer>
    </div>
  );
}

function Section({ title, markdown }: { title: string; markdown: string }) {
  if (!markdown.trim()) return null;
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="text-base font-semibold tracking-tight border-b border-gray-200 pb-1.5 mb-3">{title}</h2>
      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{markdown}</pre>
    </section>
  );
}
