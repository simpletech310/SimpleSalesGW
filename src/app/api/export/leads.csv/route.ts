import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, leadVisibilityFilter } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { buildCsv, csvDate } from "@/lib/csv";

export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "data:export")) throw new ApiError(403, "Forbidden");

    const leads = await prisma.lead.findMany({
      where: leadVisibilityFilter(user.role, user.id),
      include: { owner: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    const header = [
      "id",
      "business_name",
      "industry",
      "pipeline_stage",
      "owner_name",
      "owner_email",
      "primary_contact_name",
      "primary_contact_email",
      "primary_contact_phone",
      "seat_count",
      "site_count",
      "address_city",
      "address_state",
      "services_score",
      "customer_score",
      "deal_quality_score",
      "non_strategic_flag",
      "suggested_bundle",
      "compliance_drivers",
      "expected_close_date",
      "actual_close_date",
      "created_at",
      "updated_at",
    ];

    const rows = leads.map((l) => [
      l.id,
      l.businessName,
      l.industry,
      l.pipelineStage,
      l.owner.name,
      l.owner.email,
      l.primaryContactName,
      l.primaryContactEmail,
      l.primaryContactPhone,
      l.seatCount,
      l.siteCount,
      l.addressCity,
      l.addressState,
      l.servicesScore,
      l.customerScore,
      l.dealQualityScore,
      l.nonStrategicFlag,
      l.suggestedBundle,
      l.complianceDrivers.join("|"),
      csvDate(l.expectedCloseDate),
      csvDate(l.actualCloseDate),
      csvDate(l.createdAt),
      csvDate(l.updatedAt),
    ]);

    const body = buildCsv([header, ...rows]);

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: user.id, // export action is per-user, not per-entity
      action: "EXPORT",
      after: { exportType: "leads.csv", rowCount: leads.length },
      ...getAuditContext(req),
    });

    const filename = `gateway-leads-${new Date().toISOString().slice(0, 10)}.csv`;
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
