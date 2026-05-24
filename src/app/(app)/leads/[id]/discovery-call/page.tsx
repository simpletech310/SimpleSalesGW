import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { DiscoveryCallForm } from "./DiscoveryCallForm";
import { DiscoveryPrepButton } from "./DiscoveryPrepButton";

export default async function DiscoveryCallPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      primaryContactName: true,
      ownerUserId: true,
    },
  });
  if (!lead) notFound();
  if (lead.ownerUserId !== session.user.id && !can(session.user.role, "lead:edit:any")) {
    redirect(`/leads/${id}`);
  }

  const recent = await prisma.discoveryCallNote.findMany({
    where: { leadId: id },
    orderBy: { conductedAt: "desc" },
    take: 5,
    include: { conductedBy: { select: { name: true } } },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <Link href={`/leads/${id}`} className="text-sm text-gtn-purple underline">← {lead.businessName}</Link>
        <h1 className="text-2xl font-bold text-gtn-navy mt-2">Discovery call</h1>
        <p className="text-sm text-gtn-grey-2 mt-1">
          Structured note capture following the 45-minute Discovery Call Script
          (opening · business · tech · decision · mini-pitch · close).
        </p>
      </div>

      <DiscoveryPrepButton leadId={id} />

      <DiscoveryCallForm leadId={id} contactName={lead.primaryContactName ?? ""} />

      {recent.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gtn-navy">Recent calls on this lead</h2>
          <ul className="divide-y divide-gtn-lavender-2 border border-gtn-lavender-2 rounded-md text-sm">
            {recent.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="font-medium text-gtn-navy">
                  {new Date(n.conductedAt).toLocaleString()}{" "}
                  <span className="text-xs text-gtn-grey-2">
                    · {n.durationMinutes ?? "~45"} min · {n.conductedBy.name}
                  </span>
                </p>
                {n.nextStep && <p className="text-xs text-gtn-grey-2 mt-1">Next step: {n.nextStep}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
