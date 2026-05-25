import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can, leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { EditLeadForm } from "./EditLeadForm";

export const dynamic = "force-dynamic";

/**
 * v2.23.3 — Edit an existing lead. Mirrors /leads/new but seeded with
 * current values + PATCH instead of POST. Rep can fix anything,
 * especially the address (which the original create form didn't
 * require — that's why pre-existing leads don't show on the map).
 */
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
  // Edit requires: owner OR lead:edit:any OR team member
  const isOwnerOrMgr =
    lead.ownerUserId === session.user.id || can(session.user.role, "lead:edit:any");
  const onTeam = lead.teamId ? teams.includes(lead.teamId) : false;
  const visible = leadIsVisible(session.user.role, session.user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams);
  if (!visible) {
    return <p className="text-sm text-gtn-grey-2">Not authorized to view this lead.</p>;
  }
  if (!isOwnerOrMgr && !onTeam) {
    return <p className="text-sm text-gtn-grey-2">You don&apos;t have permission to edit this lead.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <Link href={`/leads/${id}`} className="text-xs text-gtn-purple hover:underline">← {lead.businessName}</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-1">Edit lead</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          Update any field. Changing the address will re-geocode the lead so it appears on the map.
        </p>
      </div>

      <EditLeadForm lead={lead} />
    </div>
  );
}
