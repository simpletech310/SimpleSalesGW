import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { FormPage } from "@/components/templates";
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
    <FormPage
      title="Discovery call"
      subtitle="Structured note capture following the 45-minute Discovery Call Script (opening · business · tech · decision · mini-pitch · close)."
      crumbs={[
        { href: "/leads", label: "Leads" },
        { href: `/leads/${id}`, label: lead.businessName },
        { label: "Discovery call" },
      ]}
      width="lg"
    >
      <DiscoveryPrepButton leadId={id} />
      <DiscoveryCallForm leadId={id} contactName={lead.primaryContactName ?? ""} />

      {recent.length > 0 && (
        <section className="rounded-xl bg-surface border border-line-subtle p-4 md:p-5">
          <h2 className="text-sm font-semibold text-ink-strong mb-3">Recent calls on this lead</h2>
          <ul className="divide-y divide-line-subtle -my-2">
            {recent.map((n) => (
              <li key={n.id} className="py-2.5">
                <p className="font-medium text-ink-strong text-sm">
                  {new Date(n.conductedAt).toLocaleString()}{" "}
                  <span className="text-xs text-ink-muted font-normal">
                    · {n.durationMinutes ?? "~45"} min · {n.conductedBy.name}
                  </span>
                </p>
                {n.nextStep && <p className="text-xs text-ink-muted mt-0.5">Next step: {n.nextStep}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </FormPage>
  );
}
