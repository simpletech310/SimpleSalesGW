import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ListPage } from "@/components/templates";
import { AuditFilter } from "./AuditFilter";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
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
            {
              actor: {
                is: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, email: true } } },
    take: 200,
  });

  type LogRow = (typeof logs)[number];
  const columns: Column<LogRow>[] = [
    {
      key: "when",
      header: "When",
      width: "180px",
      cell: (l) => (
        <span className="text-xs text-ink-muted whitespace-nowrap tabular">
          {format(new Date(l.createdAt), "PPp")}
        </span>
      ),
    },
    {
      key: "who",
      header: "Who",
      cell: (l) => <span className="text-sm text-ink-strong">{l.actor?.name ?? "system"}</span>,
    },
    {
      key: "action",
      header: "Action",
      cell: (l) => <span className="gtn-code-pill">{l.action}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (l) => (
        <span className="text-xs">
          <span className="text-ink-strong font-medium">{l.entityType}</span>
          <br />
          <span className="font-mono text-[10px] text-ink-faint">{l.entityId.slice(0, 8)}</span>
        </span>
      ),
    },
    {
      key: "detail",
      header: "Detail",
      cell: (l) =>
        l.before || l.after ? (
          <details>
            <summary className="cursor-pointer text-xs text-gtn-purple font-medium hover:underline">view</summary>
            <pre className="mt-2 max-w-md text-[10px] bg-surface-2 border border-line-subtle p-2 rounded-md overflow-x-auto">
              {JSON.stringify({ before: l.before, after: l.after }, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <ListPage
      title="Audit log"
      subtitle="Every state change in the portal is recorded here. Showing latest 200 records."
      crumbs={[{ href: "/admin", label: "Admin" }, { label: "Audit log" }]}
      actions={
        <Button asChild variant="secondary" size="sm">
          <a href="/api/export/audit-log.csv" download>Export CSV</a>
        </Button>
      }
      toolbar={<AuditFilter defaultQuery={q ?? ""} />}
      body={
        <DataTable
          columns={columns}
          rows={logs}
          getRowKey={(l) => l.id}
          density="default"
          empty="No audit records."
        />
      }
    />
  );
}
