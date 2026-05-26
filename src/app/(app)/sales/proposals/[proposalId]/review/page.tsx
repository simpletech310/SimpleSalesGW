import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { DetailPage } from "@/components/templates";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";

export default async function ProposalReviewPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "proposal:vcio-review") && !can(session.user.role, "proposal:manager-review")) {
    redirect("/");
  }
  const { proposalId } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lead: { select: { id: true, businessName: true, industry: true, seatCount: true } },
      template: { select: { name: true } },
    },
  });
  if (!proposal) notFound();

  // What can THIS user do based on status?
  const myTier =
    proposal.status === "VCIO_REVIEW" && can(session.user.role, "proposal:vcio-review") ? "VCIO"
    : proposal.status === "MANAGER_REVIEW" && can(session.user.role, "proposal:manager-review") ? "MANAGER"
    : null;

  return (
    <DetailPage
      crumbs={[
        { href: "/sales", label: "Sales hub" },
        { href: "/sales/proposals", label: "Proposals queue" },
        { label: `${proposal.lead.businessName} v${proposal.version}` },
      ]}
      eyebrow={myTier ? `${myTier} review` : "Proposal"}
      title={proposal.lead.businessName}
      subtitle={`Version ${proposal.version}${proposal.template ? ` · ${proposal.template.name}` : ""}`}
      badges={
        <>
          <Badge tone="brand" shape="pill" size="sm">{proposal.status.toLowerCase().replace(/_/g, " ")}</Badge>
          {proposal.aiDraftedAt && <Badge tone="accent" shape="pill" size="xs">AI-drafted</Badge>}
        </>
      }
      actions={
        <Link
          href={`/leads/${proposal.lead.id}/proposal/${proposal.id}/print`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gtn-purple hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview as customer will see
        </Link>
      }
    >
      {!myTier && (
        <div className="rounded-md bg-warn-soft/40 border border-warn/40 p-3 text-xs text-gtn-amber">
          This proposal is not awaiting your review tier (current status: <strong>{proposal.status}</strong>).
        </div>
      )}

      <Section title="Scope" body={proposal.scopeMarkdown} />
      <Section title="Deliverables" body={proposal.deliverablesMarkdown} />
      <Section title="Timeline" body={proposal.timelineMarkdown} />
      <Section title="Exclusions" body={proposal.exclusionsMarkdown} />
      <Section title="Terms" body={proposal.termsMarkdown} />

      {myTier && (
        <ReviewForm
          leadId={proposal.lead.id}
          proposalId={proposal.id}
          tier={myTier}
        />
      )}
    </DetailPage>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-xl bg-surface border border-line-subtle p-4">
      <h2 className="text-xs uppercase tracking-wide text-ink-muted font-semibold mb-2">{title}</h2>
      <pre className="whitespace-pre-wrap text-sm text-ink-strong leading-relaxed font-mono">{body.trim() || "(empty)"}</pre>
    </section>
  );
}
