import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QUESTIONS } from "@/lib/assessment/questions";
import { AssessmentRunner } from "./AssessmentRunner";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { lead: { select: { id: true, businessName: true } }, answers: true },
  });
  if (!assessment) notFound();
  if (assessment.status === "COMPLETED") redirect(`/assessment/${id}/result`);

  const initialAnswers: Record<string, unknown> = {};
  for (const a of assessment.answers) initialAnswers[a.questionId] = a.answerValue;

  return (
    <AssessmentRunner
      assessmentId={id}
      leadName={assessment.lead.businessName}
      leadHref={`/leads/${assessment.lead.id}`}
      questions={QUESTIONS as unknown as typeof QUESTIONS}
      initialAnswers={initialAnswers}
    />
  );
}
