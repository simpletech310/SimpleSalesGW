import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer, can } from "@/lib/rbac";
import { bankForKind, discoveryTitle } from "@/lib/discovery/banks";
import { DiscoveryRunner } from "./DiscoveryRunner";
import { DiscoveryResult } from "./DiscoveryResult";
// v2.23 — vCIO plan panel below the scorecard for completed assessments
import { VcioPlanPanel } from "@/components/sales/VcioPlanPanel";

export const dynamic = "force-dynamic";

export default async function DiscoveryAssessmentPage({ params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, assessmentId } = await params;

  const assessment = await prisma.discoveryAssessment.findUnique({
    where: { id: assessmentId },
    include: {
      customer: { include: { lead: { select: { businessName: true, ownerUserId: true } } } },
      // v2.23 — pull the planAcceptedBy name for the accepted banner
      planAcceptedBy: { select: { name: true } },
    },
  });
  // v2.17 — customer is now nullable on the model; explicitly guard so TS
  // narrows for the rest of this server component.
  if (!assessment || !assessment.customer || assessment.customerId !== id) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, assessment.customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const bank = bankForKind(assessment.kind);
  const title = discoveryTitle(assessment.kind);

  if (assessment.status === "COMPLETED") {
    const canEditDiscovery = can(session.user.role, "discovery:edit");
    return (
      <div className="space-y-4">
        <DiscoveryResult
          title={title}
          customerName={assessment.customer.lead.businessName}
          customerId={id}
          assessmentId={assessment.id}
          scorecard={assessment.scorecard as never}
        />
        {/* v2.23 — vCIO plan: generate, review, accept → seeds onboarding tasks */}
        {canEditDiscovery && (
          <VcioPlanPanel
            generateUrl={`/api/accounts/${id}/discovery/${assessment.id}/vcio-plan`}
            acceptUrl={`/api/accounts/${id}/discovery/${assessment.id}/accept-plan`}
            initialPlan={(assessment.aiPlanSnapshot as never) ?? null}
            acceptedAt={assessment.planAcceptedAt ? assessment.planAcceptedAt.toISOString() : null}
            acceptedByName={assessment.planAcceptedBy?.name ?? null}
            onboardingTasksUrl={`/accounts/${id}/onboarding/tasks`}
            printDocUrl={`/accounts/${id}/discovery/${assessment.id}/site-survey-doc`}
          />
        )}
      </div>
    );
  }

  return (
    <DiscoveryRunner
      title={title}
      customerName={assessment.customer.lead.businessName}
      customerId={id}
      assessmentId={assessment.id}
      questions={bank.questions}
      initialAnswers={(assessment.answers as Record<string, unknown>) ?? {}}
    />
  );
}
