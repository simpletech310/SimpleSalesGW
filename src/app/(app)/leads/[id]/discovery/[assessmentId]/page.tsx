import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { bankForKind, discoveryTitle } from "@/lib/discovery/banks";
import { DiscoveryRunner } from "@/app/(app)/accounts/[id]/discovery/[assessmentId]/DiscoveryRunner";
import { DiscoveryResult } from "@/app/(app)/accounts/[id]/discovery/[assessmentId]/DiscoveryResult";

export const dynamic = "force-dynamic";

/**
 * v2.17 — Lead-scoped pre-sale discovery runner.
 *
 * Mirror of the customer-scoped /accounts/[id]/discovery/[assessmentId]
 * page; reuses the same DiscoveryRunner + DiscoveryResult components with
 * the new `apiBase` + `backHref` props pointing at the lead-scoped routes.
 */
export default async function LeadDiscoveryAssessmentPage({
  params,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, assessmentId } = await params;

  const assessment = await prisma.discoveryAssessment.findUnique({
    where: { id: assessmentId },
    include: { lead: { select: { businessName: true, ownerUserId: true, pipelineStage: true } } },
  });
  if (!assessment || !assessment.lead || assessment.leadId !== id) notFound();
  // v2.17.1 — VCIO's `leadIsVisible` short-circuits to PRE_SALES+, which
  // would block early-stage pre-sale scoping (exactly what this page is
  // for). Bypass: anyone with `discovery:edit` who's been asked to scope a
  // lead can view that lead's runner regardless of stage.
  const canViewRunner =
    leadIsVisible(session.user.role, session.user.id, assessment.lead.ownerUserId, assessment.lead.pipelineStage) ||
    can(session.user.role, "discovery:edit");
  if (!canViewRunner) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const bank = bankForKind(assessment.kind);
  const title = `${discoveryTitle(assessment.kind)} (pre-sale)`;
  const apiBase = `/api/leads/${id}/discovery/${assessmentId}`;
  const backHref = `/leads/${id}`;

  if (assessment.status === "COMPLETED") {
    return (
      <DiscoveryResult
        title={title}
        customerName={assessment.lead.businessName}
        customerId={id /* used only for the prop name; ignored when backHref provided */}
        assessmentId={assessment.id}
        scorecard={assessment.scorecard as never}
        backHref={backHref}
        // Print view stays on the customer route family; pre-sale print is out of scope for v2.17.
        printHref={backHref}
      />
    );
  }

  return (
    <DiscoveryRunner
      title={title}
      customerName={assessment.lead.businessName}
      customerId={id}
      assessmentId={assessment.id}
      questions={bank.questions}
      initialAnswers={(assessment.answers as Record<string, unknown>) ?? {}}
      apiBase={apiBase}
      backHref={backHref}
    />
  );
}
