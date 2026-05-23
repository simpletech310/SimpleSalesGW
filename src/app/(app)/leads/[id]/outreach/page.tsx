import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadOutreachTemplates } from "@/lib/outreach/templates";
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

  // Industry-filter so the composer surfaces vertical-specific templates first.
  const templates = await loadOutreachTemplates({ industry: lead.industry });

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gtn-navy">Send outreach</h1>
      <p className="text-sm text-gtn-grey-2 mb-6">{lead.businessName}</p>
      <OutreachComposer lead={lead} templates={templates} senderName={session.user.name ?? "Lin"} />
    </div>
  );
}
