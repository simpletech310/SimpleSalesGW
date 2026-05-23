import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canSeeCustomer } from "@/lib/rbac";
import { QbrEditor } from "./QbrEditor";

export const dynamic = "force-dynamic";

export default async function QbrPage({ params }: { params: Promise<{ id: string; qbrId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id, qbrId } = await params;

  const qbr = await prisma.qbr.findUnique({
    where: { id: qbrId },
    include: { customer: { include: { lead: { select: { businessName: true, ownerUserId: true } } } } },
  });
  if (!qbr || qbr.customerId !== id) notFound();
  if (!canSeeCustomer(session.user.role, session.user.id, qbr.customer.lead.ownerUserId)) {
    return <p className="text-sm text-gtn-grey-2">Not authorized.</p>;
  }

  return (
    <QbrEditor
      customerId={id}
      customerName={qbr.customer.lead.businessName}
      qbr={{
        id: qbr.id,
        scheduledAt: qbr.scheduledAt.toISOString(),
        completedAt: qbr.completedAt?.toISOString() ?? null,
        attendees: (qbr.attendees as never) ?? [],
        agenda: (qbr.agenda as never) ?? [],
        outcomes: qbr.outcomes,
        followUps: (qbr.followUps as never) ?? [],
      }}
    />
  );
}
