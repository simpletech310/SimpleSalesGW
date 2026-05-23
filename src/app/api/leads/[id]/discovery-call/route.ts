import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  conductedAt:      z.string().datetime().optional(),
  durationMinutes:  z.coerce.number().int().min(0).max(720).optional(),
  openingNotes:     z.string().max(8000).optional(),
  businessNotes:    z.string().max(8000).optional(),
  techNotes:        z.string().max(8000).optional(),
  decisionNotes:    z.string().max(8000).optional(),
  miniPitchNotes:   z.string().max(8000).optional(),
  closeNotes:       z.string().max(8000).optional(),
  nextStep:         z.string().max(400).optional(),
  nextStepDueAt:    z.string().datetime().optional(),
  commitments:      z.array(z.object({
    text:      z.string().max(400),
    ownerName: z.string().max(200).optional(),
    dueAt:     z.string().optional(),
  })).optional(),
  redFlags:         z.array(z.object({
    text:     z.string().max(400),
    severity: z.enum(["high", "medium", "low"]).optional(),
  })).optional(),
  preCallChecklist: z.record(z.boolean()).optional(),
});

async function authorize(leadId: string, write: boolean) {
  const user = await requireSessionUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { ownerUserId: true } });
  if (!lead) throw new ApiError(404, "Lead not found");
  const isOwner = lead.ownerUserId === user.id;
  if (write) {
    if (!isOwner && !can(user.role, "lead:edit:any")) throw new ApiError(403, "Forbidden");
  } else {
    if (!isOwner && !can(user.role, "lead:view:all")) throw new ApiError(403, "Forbidden");
  }
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await authorize(id, false);
    const notes = await prisma.discoveryCallNote.findMany({
      where: { leadId: id },
      orderBy: { conductedAt: "desc" },
      include: { conductedBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ notes });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await authorize(id, true);
    const data = createSchema.parse(await req.json());
    const conductedAt = data.conductedAt ? new Date(data.conductedAt) : new Date();
    const nextStepDueAt = data.nextStepDueAt ? new Date(data.nextStepDueAt) : null;

    const note = await prisma.discoveryCallNote.create({
      data: {
        leadId: id,
        conductedAt,
        conductedByUserId: user.id,
        durationMinutes: data.durationMinutes ?? null,
        openingNotes:    data.openingNotes ?? null,
        businessNotes:   data.businessNotes ?? null,
        techNotes:       data.techNotes ?? null,
        decisionNotes:   data.decisionNotes ?? null,
        miniPitchNotes:  data.miniPitchNotes ?? null,
        closeNotes:      data.closeNotes ?? null,
        nextStep:        data.nextStep ?? null,
        nextStepDueAt,
        commitments:     (data.commitments ?? []) as object,
        redFlags:        (data.redFlags ?? []) as object,
        preCallChecklist:(data.preCallChecklist ?? {}) as object,
      },
    });

    // Activity entry for the lead's history.
    await prisma.activity.create({
      data: {
        leadId: id,
        actorUserId: user.id,
        type: "MEETING",
        subject: `Discovery call (${data.durationMinutes ?? "~45"} min)`,
        body: data.nextStep ? `Next step: ${data.nextStep}` : null,
        nextAction: data.nextStep ?? null,
        nextActionDueAt: nextStepDueAt,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "DiscoveryCallNote",
      entityId: note.id,
      action: "CREATE",
      after: { leadId: id, conductedAt: note.conductedAt.toISOString() },
      ...getAuditContext(req),
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
