import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { FileText, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Badge } from "@/components/ui/Badge";
import { ListPage } from "@/components/templates";
import { EmptyState } from "@/components/help/EmptyState";

export const dynamic = "force-dynamic";

export default async function ProposalsQueuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "proposal:vcio-review") && !can(session.user.role, "proposal:manager-review")) {
    redirect("/");
  }

  // Pull proposals awaiting THIS user's review tier
  const awaitingVcio = can(session.user.role, "proposal:vcio-review");
  const awaitingMgr = can(session.user.role, "proposal:manager-review");

  const proposals = await prisma.proposal.findMany({
    where: {
      OR: [
        ...(awaitingVcio ? [{ status: "VCIO_REVIEW" as const }] : []),
        ...(awaitingMgr ? [{ status: "MANAGER_REVIEW" as const }] : []),
      ],
    },
    orderBy: { updatedAt: "asc" },
    include: {
      lead: { select: { id: true, businessName: true, industry: true, seatCount: true, owner: { select: { name: true } } } },
      template: { select: { name: true } },
    },
  });

  return (
    <ListPage
      title="Proposals queue"
      subtitle="Drafts awaiting your review. vCIO validates scope; Sales Manager validates pricing. Each row links to the lead's Proposal tab where you can read, run the AI scope-QC scan, and submit a verdict."
      crumbs={[{ href: "/sales", label: "Sales hub" }, { label: "Proposals" }]}
    >
      {proposals.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title="Inbox zero"
          body="No proposals awaiting your review. New ones land here automatically when a salesperson clicks 'Request review'."
        />
      ) : (
        <div className="rounded-xl bg-surface border border-line-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="ui-label text-left px-4 py-2.5">Lead</th>
                <th className="ui-label text-left px-4 py-2.5">Template</th>
                <th className="ui-label text-left px-4 py-2.5">Status</th>
                <th className="ui-label text-left px-4 py-2.5">Owner</th>
                <th className="ui-label text-left px-4 py-2.5">Waiting</th>
                <th className="ui-label text-right px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => {
                const waitMs = Date.now() - new Date(p.updatedAt).getTime();
                const stale = waitMs > 24 * 60 * 60 * 1000;
                return (
                  <tr key={p.id} className="border-t border-line-subtle hover:bg-surface-3/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${p.lead.id}`} className="text-ink-strong hover:text-gtn-purple font-medium">
                        {p.lead.businessName}
                      </Link>
                      <p className="text-[11px] text-ink-faint capitalize">
                        {p.lead.industry.replace(/_/g, " ").toLowerCase()}{p.lead.seatCount ? ` · ${p.lead.seatCount} seats` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {p.template?.name ?? "(no template)"} · v{p.version}
                      {p.aiDraftedAt && (
                        <Badge tone="accent" shape="pill" size="xs" className="ml-2">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.status === "VCIO_REVIEW" ? "brand" : "accent"} shape="pill" size="xs">
                        {p.status.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{p.lead.owner.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs tabular ${stale ? "text-gtn-amber font-semibold" : "text-ink-muted"}`}>
                        {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/sales/proposals/${p.id}/review`}
                        className="text-xs font-medium text-gtn-purple hover:underline"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ListPage>
  );
}
