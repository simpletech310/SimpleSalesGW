import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { buildCsv, csvDate } from "@/lib/csv";

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "audit:view")) throw new ApiError(403, "Forbidden");

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
      take: 5000,
    });

    const header = [
      "created_at",
      "actor_name",
      "actor_email",
      "action",
      "entity_type",
      "entity_id",
      "before",
      "after",
      "ip_address",
      "user_agent",
    ];

    const rows = logs.map((l) => [
      csvDate(l.createdAt),
      l.actor?.name ?? "",
      l.actor?.email ?? "",
      l.action,
      l.entityType,
      l.entityId,
      l.before ? JSON.stringify(l.before) : "",
      l.after ? JSON.stringify(l.after) : "",
      l.ipAddress ?? "",
      l.userAgent ?? "",
    ]);

    const body = buildCsv([header, ...rows]);

    await writeAudit({
      actorUserId: user.id,
      entityType: "AuditLog",
      entityId: user.id,
      action: "EXPORT",
      after: { exportType: "audit-log.csv", rowCount: logs.length },
      ...getAuditContext(req),
    });

    const filename = `gateway-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
