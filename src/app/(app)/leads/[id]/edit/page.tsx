import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { FormPage } from "@/components/templates";
import { EditLeadForm } from "./EditLeadForm";

export const dynamic = "force-dynamic";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      ownerUserId: true,
      pipelineStage: true,
      teamId: true,
      businessName: true,
      industry: true,
      source: true,
      seatCount: true,
      siteCount: true,
      addressStreet: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      websiteUrl: true,
      linkedinCompanyUrl: true,
      googleBusinessUrl: true,
      primaryContactName: true,
      primaryContactTitle: true,
      primaryContactEmail: true,
      primaryContactPhone: true,
      executiveSponsorName: true,
      executiveSponsorTitle: true,
      currentMspName: true,
      currentMspSatisfaction: true,
    },
  });
  if (!lead) notFound();
  const teams = await userTeamIds(session.user.id);
  const isOwnerOrMgr = lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any");
  const onTeam = lead.teamId ? teams.includes(lead.teamId) : false;
  const visible = leadIsVisible(session.user.role, session.user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams);
  if (!visible) {
    return <p className="text-sm text-ink-muted">Not authorized to view this lead.</p>;
  }
  if (!isOwnerOrMgr && !onTeam) {
    return <p className="text-sm text-ink-muted">You don&apos;t have permission to edit this lead.</p>;
  }

  return (
    <FormPage
      title="Edit lead"
      subtitle="Update any field. Changing the address will re-geocode the lead so it appears on the map."
      crumbs={[
        { href: "/leads", label: "Leads" },
        { href: `/leads/${id}`, label: lead.businessName },
        { label: "Edit" },
      ]}
      width="lg"
    >
      <EditLeadForm lead={lead} />
    </FormPage>
  );
}
