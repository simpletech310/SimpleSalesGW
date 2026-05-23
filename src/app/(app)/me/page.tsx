import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";

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
    <div className="max-w-2xl space-y-4">
      <Card>
        <h1 className="text-xl font-bold text-gtn-navy">{user.name}</h1>
        <p className="text-sm text-gtn-grey-2">{user.email}</p>
        <p className="text-xs uppercase tracking-wide text-gtn-purple mt-2">{user.role.replace("_", " ")}</p>
      </Card>
      <Card>
        <h2 className="text-sm font-semibold mb-3">Open next-actions</h2>
        {myOpenActions.length === 0 ? (
          <p className="text-sm text-gtn-grey-2">Nothing due. Inbox zero.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {myOpenActions.map((a) => (
              <li key={a.id}>
                <a className="text-gtn-purple underline" href={`/leads/${a.lead.id}`}>{a.lead.businessName}</a>
                <span className="text-gtn-grey-2"> — {a.nextAction}</span>
                <span className="block text-xs text-gtn-grey-3">{a.nextActionDueAt?.toString().slice(0,16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
