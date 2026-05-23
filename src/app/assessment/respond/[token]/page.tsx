import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QUESTIONS } from "@/lib/assessment/questions";
import { resolveToken } from "@/lib/assessment/tokens";
import { AssessmentRunner } from "@/app/(app)/assessment/[id]/AssessmentRunner";
import { GatewayLogo } from "@/components/brand/GatewayLogo";

export const dynamic = "force-dynamic";

export default async function RespondPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await resolveToken(token);
  if (!res.ok) {
    if (res.reason === "expired" || res.reason === "completed") {
      redirect(`/assessment/respond/${token}/expired`);
    }
    notFound();
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: res.assessmentId },
    include: { lead: { select: { businessName: true } }, answers: true },
  });
  if (!assessment) notFound();

  const initialAnswers: Record<string, unknown> = {};
  for (const a of assessment.answers) initialAnswers[a.questionId] = a.answerValue;

  return (
    <div className="min-h-dvh bg-gtn-lavender">
      <header className="bg-gtn-navy">
        <div className="container py-3">
          <GatewayLogo variant="onDark" size="sm" />
        </div>
      </header>
      <main className="container py-8">
        <div className="max-w-2xl mx-auto mb-6">
          <h1 className="text-2xl font-bold text-gtn-navy">Gateway IT Assessment</h1>
          <p className="text-sm text-gtn-grey-2">
            Twenty-five questions for {assessment.lead.businessName}. Takes about 10 minutes. Your progress saves as you go.
          </p>
        </div>
        <AssessmentRunner
          assessmentId={assessment.id}
          leadName={assessment.lead.businessName}
          leadHref="#"
          questions={QUESTIONS as unknown as typeof QUESTIONS}
          initialAnswers={initialAnswers}
          mode="respondent"
          token={token}
          onSubmitRedirect={`/assessment/respond/${token}/done`}
        />
      </main>
      <footer className="bg-gtn-lavender-2 mt-12">
        <div className="container py-6 text-center text-xs text-gtn-grey-2">
          © Gateway TelNet · Sales made simple. Operations made sure.
        </div>
      </footer>
    </div>
  );
}
