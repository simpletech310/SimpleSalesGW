import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { bankForKind, discoveryTitle } from "@/lib/discovery/banks";
import { DiscoveryRunner } from "./DiscoveryRunner";
import { DiscoveryResult } from "./DiscoveryResult";

export const dynamic = "force-dynamic";

export default async function DiscoveryAssessmentPage({ params }: { params: Promise<{ id: string; assessmentId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, assessmentId } = await params;

  const assessment = await prisma.discoveryAssessment.findUnique({
    where: { id: assessmentId },
    include: { customer: { include: { lead: { select: { businessName: true, ownerUserId: true } } } } },
  });
  if (!assessment || assessment.customerId !== id) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, assessment.customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  const bank = bankForKind(assessment.kind);
  const title = discoveryTitle(assessment.kind);

  if (assessment.status === "COMPLETED") {
    return (
      <DiscoveryResult
        title={title}
        customerName={assessment.customer.lead.businessName}
        customerId={id}
        assessmentId={assessment.id}
        scorecard={assessment.scorecard as never}
      />
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
