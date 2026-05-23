import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { HandoffForm } from "./HandoffForm";

export default async function HandoffPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "handoff:initiate")) redirect(`/leads/${(await params).id}`);

  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      serviceMatches: { where: { recommended: true } },
    },
  });
  if (!lead) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gtn-navy">Sales-to-Ops handoff</h1>
      <p className="text-sm text-gtn-grey-2 mb-6">{lead.businessName}</p>
      <HandoffForm lead={lead as never} />
    </div>
  );
}
