import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ListPage } from "@/components/templates";
import { AuditFilter } from "./AuditFilter";
import type { AuditAction } from "@prisma/client";

const ACTION_TONE: Record<AuditAction, "brand" | "success" | "warn" | "danger" | "neutral"> = {
  CREATE:  "success",
  UPDATE:  "brand",
  DELETE:  "danger",
  APPROVE: "success",
  REJECT:  "danger",
  LOGIN:   "neutral",
  EXPORT:  "warn",
};

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
        <div>
          <p className="text-xs text-ink-strong font-medium whitespace-nowrap tabular">
            {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
          </p>
          <p className="text-[10px] text-ink-faint tabular whitespace-nowrap mt-0.5">
            {format(new Date(l.createdAt), "MMM d, p")}
          </p>
        </div>
      ),
    },
    {
      key: "who",
      header: "Who",
      cell: (l) => (
        <span className="text-sm text-ink-strong">
          {l.actor?.name ?? <span className="italic text-ink-faint">System</span>}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      width: "120px",
      cell: (l) => (
        <Badge tone={ACTION_TONE[l.action] ?? "neutral"} shape="pill" size="xs">
          {l.action.toLowerCase()}
        </Badge>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      cell: (l) => (
        <div>
          <p className="text-sm font-medium text-ink-strong">{l.entityType}</p>
          <p className="font-mono text-[10px] text-ink-faint tabular truncate">{l.entityId.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: "detail",
      header: "Detail",
      hideOnMobile: true,
      cell: (l) =>
        l.before || l.after ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-gtn-purple font-medium hover:underline list-none inline-flex items-center gap-1">
              <span>view diff</span>
            </summary>
            <pre className="mt-2 max-w-md text-[10px] bg-surface-2 border border-line-subtle p-2.5 rounded-md overflow-x-auto leading-relaxed">
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
