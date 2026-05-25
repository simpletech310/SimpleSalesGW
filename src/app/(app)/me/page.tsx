import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardPage, DashboardSection } from "@/components/templates";
import { Badge } from "@/components/ui/Badge";

export default async function MePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email ?? "" },
    select: { id: true, name: true, email: true, role: true, phone: true, lastLoginAt: true, createdAt: true },
  });
  if (!user) redirect("/login");

  const myOpenActions = await prisma.activity.findMany({
    where: { actorUserId: user.id, nextActionCompleted: false, nextActionDueAt: { not: null } },
    orderBy: { nextActionDueAt: "asc" },
    include: { lead: { select: { id: true, businessName: true } } },
    take: 20,
  });

  return (
    <DashboardPage
      eyebrow="Your profile"
      title={user.name ?? "Me"}
      subtitle={user.email}
      meta={<Badge tone="brand" shape="pill" size="sm" dot>{user.role.replace("_", " ").toLowerCase()}</Badge>}
    >
      <DashboardSection title="Open next-actions" subtitle="Activities you've scheduled across your leads.">
        {myOpenActions.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing due. Inbox zero.</p>
        ) : (
          <ul className="divide-y divide-line-subtle -my-2">
            {myOpenActions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/leads/${a.lead.id}`} className="text-ink-strong font-medium hover:text-gtn-purple">
                    {a.lead.businessName}
                  </Link>
                  <p className="text-sm text-ink-muted truncate">{a.nextAction}</p>
                </div>
                <span className="text-xs text-ink-faint flex-shrink-0 tabular whitespace-nowrap">
                  {a.nextActionDueAt?.toString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}
