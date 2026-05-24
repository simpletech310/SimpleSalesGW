import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { leadVisibilityFilter } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import { Card } from "@/components/ui/Card";
import { LeadsMap } from "./LeadsMap";

export default async function LeadsMapPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const teamIds = await userTeamIds(session.user.id);
  const filter = leadVisibilityFilter(session.user.role, session.user.id, teamIds);

  const leads = await prisma.lead.findMany({
    where: {
      AND: [filter, { addressLat: { not: null }, addressLng: { not: null } }],
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      businessName: true,
      pipelineStage: true,
      dealQualityScore: true,
      addressCity: true,
      addressState: true,
      addressLat: true,
      addressLng: true,
      team: { select: { name: true } },
    },
  });

  // Total leads (incl ungeocoded) for the meta
  const totalVisible = await prisma.lead.count({ where: filter });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gtn-navy">Leads on map</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          {leads.length} of {totalVisible} visible leads have geocoded addresses.{" "}
          <Link href="/leads" className="text-gtn-purple hover:underline">Back to list view</Link>
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <LeadsMap
          leads={leads.map((l) => ({
            id: l.id,
            name: l.businessName,
            stage: l.pipelineStage,
            dq: l.dealQualityScore,
            city: l.addressCity,
            state: l.addressState,
            teamName: l.team?.name ?? null,
            lat: Number(l.addressLat),
            lng: Number(l.addressLng),
          }))}
        />
      </Card>

      {totalVisible > leads.length && (
        <Card>
          <p className="text-sm text-gtn-grey-2">
            {totalVisible - leads.length} lead{(totalVisible - leads.length) === 1 ? "" : "s"} aren&apos;t pinned yet.
            Either no address on file or geocoding failed. Open a lead and click &ldquo;Re-geocode address&rdquo; to retry.
          </p>
        </Card>
      )}
    </div>
  );
}
