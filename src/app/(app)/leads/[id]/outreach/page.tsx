import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadOutreachTemplates } from "@/lib/outreach/templates";
import { FormPage } from "@/components/templates";
import { OutreachComposer } from "./OutreachComposer";

export default async function OutreachPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      industry: true,
      primaryContactName: true,
      primaryContactEmail: true,
    },
  });
  if (!lead) notFound();

  const templates = await loadOutreachTemplates({ industry: lead.industry });

  return (
    <FormPage
      title="Send outreach"
      subtitle={lead.businessName}
      crumbs={[
        { href: "/leads", label: "Leads" },
        { href: `/leads/${id}`, label: lead.businessName },
        { label: "Outreach" },
      ]}
      width="lg"
    >
      <OutreachComposer lead={lead} templates={templates} senderName={session.user.name ?? "Lin"} />
    </FormPage>
  );
}
