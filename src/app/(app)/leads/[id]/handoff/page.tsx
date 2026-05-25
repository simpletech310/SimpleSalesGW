import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { FormPage } from "@/components/templates";
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
    },
  });
  if (!lead) notFound();

  return (
    <FormPage
      title="Sales-to-Ops handoff"
      subtitle={lead.businessName}
      crumbs={[
        { href: "/leads", label: "Leads" },
        { href: `/leads/${id}`, label: lead.businessName },
        { label: "Handoff" },
      ]}
      width="lg"
    >
      <HandoffForm lead={lead as never} />
    </FormPage>
  );
}
