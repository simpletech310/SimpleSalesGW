import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui/Card";
import { AuditFilter } from "./AuditFilter";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!can(session.user.role, "audit:view")) redirect("/");
  const sp = await searchParams;
  const q = sp.q?.trim();

  const logs = await prisma.auditLog.findMany({
    where: q
      ? {
          OR: [
            { entityType: { contains: q, mode: "insensitive" } },
            { entityId: { equals: q } },
            { actor: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, email: true } } },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gtn-navy">Audit log</h1>
      <AuditFilter defaultQuery={q ?? ""} />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gtn-lavender text-left text-xs uppercase tracking-wide text-gtn-grey-2">
            <tr>
              <th className="px-3 py-3">When</th>
              <th className="px-3 py-3">Who</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Entity</th>
              <th className="px-3 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-gtn-lavender-2 align-top">
                <td className="px-3 py-3 text-xs text-gtn-grey-2 whitespace-nowrap">{format(new Date(l.createdAt), "PPp")}</td>
                <td className="px-3 py-3 text-xs">{l.actor?.name ?? "system"}</td>
                <td className="px-3 py-3"><span className="gtn-code-pill">{l.action}</span></td>
                <td className="px-3 py-3 text-xs">{l.entityType}<br/><span className="font-mono text-[10px] text-gtn-grey-3">{l.entityId.slice(0, 8)}</span></td>
                <td className="px-3 py-3 text-xs">
                  {(l.before || l.after) ? (
                    <details>
                      <summary className="cursor-pointer text-gtn-purple">view</summary>
                      <pre className="mt-2 max-w-md text-[10px] bg-gtn-lavender p-2 rounded overflow-x-auto">{JSON.stringify({ before: l.before, after: l.after }, null, 2)}</pre>
                    </details>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gtn-grey-2">No audit records.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
