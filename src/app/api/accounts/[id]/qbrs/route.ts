import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  scheduledAt: z.string().datetime(),
  attendees: z.array(z.object({ name: z.string(), role: z.string().optional(), email: z.string().email().optional() })).optional(),
  agenda: z.array(z.object({ title: z.string(), notes: z.string().optional() })).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "qbr:schedule")) throw new ApiError(403, "Forbidden");
    const { id } = await params;
    const data = schema.parse(await req.json());

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { lead: { select: { primaryContactName: true, primaryContactEmail: true, executiveSponsorName: true } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");

    // Default attendees from Lead contacts when not provided.
    const defaultAttendees = data.attendees ?? [
      customer.lead.primaryContactName
        ? { name: customer.lead.primaryContactName, role: "Primary contact", email: customer.lead.primaryContactEmail ?? undefined }
        : null,
      customer.lead.executiveSponsorName
        ? { name: customer.lead.executiveSponsorName, role: "Executive sponsor" }
        : null,
    ].filter(Boolean) as Array<{ name: string; role?: string; email?: string }>;

    const qbr = await prisma.qbr.create({
      data: {
        customerId: id,
        scheduledAt: new Date(data.scheduledAt),
        attendees: defaultAttendees as never,
        agenda: (data.agenda ?? [
          { title: "Recap last quarter" },
          { title: "Roadmap progress" },
          { title: "New initiatives" },
          { title: "Risks and blockers" },
          { title: "Next quarter priorities" },
        ]) as never,
      },
    });

    // Push out the customer's nextQbrAt to roughly the next cadence.
    await prisma.customer.update({
      where: { id },
      data: {
        nextQbrAt: new Date(new Date(data.scheduledAt).getTime() + customer.qbrFrequencyDays * 24 * 60 * 60 * 1000),
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "Qbr",
      entityId: qbr.id,
      action: "CREATE",
      after: { customerId: id, scheduledAt: data.scheduledAt },
      ...getAuditContext(req),
    });

    return NextResponse.json({ qbr }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
