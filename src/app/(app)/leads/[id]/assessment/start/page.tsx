import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AssessmentMode, AssessmentStatus } from "@prisma/client";
import { can } from "@/lib/rbac";

export default async function StartAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "assessment:run")) redirect(`/leads/${(await params).id}`);
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) redirect("/leads");

  const assessment = await prisma.assessment.create({
    data: {
      leadId: id,
      createdByUserId: session.user.id,
      mode: AssessmentMode.IN_PERSON,
      status: AssessmentStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  });
  redirect(`/assessment/${assessment.id}`);
}
