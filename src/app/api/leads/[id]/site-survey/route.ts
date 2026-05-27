import { NextResponse } from "next/server";
import { z } from "zod";
import { SiteSurveyClientType, SiteSurveyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  scheduledDate: z.string().min(1),
  scheduledStart: z.string().min(1),
  scheduledEnd: z.string().min(1),
  timezone: z.string().optional(),
  pocName: z.string().min(1),
  pocTitle: z.string().min(1),
  pocEmail: z.string().email(),
  pocPhone: z.string().min(7),
  pocCanAuthorize: z.boolean(),
  clientType: z.nativeEnum(SiteSurveyClientType),
  notesForVcio: z.string().optional().nullable(),
  vcioUserId: z.string().uuid().optional().nullable(),
});

const patchSchema = createSchema.partial();

function canEditSurvey(role: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  return can(role as never, "lead:edit:any");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, ownerUserId: true } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:view:all")) {
      throw new ApiError(403, "Forbidden");
    }
    const survey = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    return NextResponse.json({ siteSurvey: survey });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const input = createSchema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!canEditSurvey(user.role, lead.ownerUserId === user.id)) {
      throw new ApiError(403, "Forbidden");
    }
    if (!input.pocCanAuthorize) {
      throw new ApiError(400, "POC must be confirmed as able to authorize decisions before scheduling the survey.");
    }

    const existing = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    if (existing) {
      throw new ApiError(409, "A site survey already exists for this lead — use PATCH to update it.");
    }

    const survey = await prisma.siteSurvey.create({
      data: {
        leadId: id,
        scheduledDate: new Date(input.scheduledDate),
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        timezone: input.timezone ?? "America/New_York",
        pocName: input.pocName,
        pocTitle: input.pocTitle,
        pocEmail: input.pocEmail,
        pocPhone: input.pocPhone,
        pocCanAuthorize: input.pocCanAuthorize,
        clientType: input.clientType,
        notesForVcio: input.notesForVcio ?? null,
        vcioUserId: input.vcioUserId ?? null,
        status: SiteSurveyStatus.AWAITING_VCIO_ACCEPT,
        createdById: user.id,
      },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "SiteSurvey",
      entityId: survey.id,
      action: "CREATE",
      after: { leadId: id, clientType: survey.clientType, status: survey.status },
      ...getAuditContext(req),
    });

    return NextResponse.json({ siteSurvey: survey }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const input = patchSchema.parse(await req.json());

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (!canEditSurvey(user.role, lead.ownerUserId === user.id)) {
      throw new ApiError(403, "Forbidden");
    }

    const existing = await prisma.siteSurvey.findUnique({ where: { leadId: id } });
    if (!existing) throw new ApiError(404, "Site survey not found");

    // After vCIO has accepted, the rep can't silently change date/POC. Allow
    // edits but require the vCIO to re-accept by flipping status back.
    const data: Record<string, unknown> = {};
    if (input.scheduledDate !== undefined)   data.scheduledDate = new Date(input.scheduledDate);
    if (input.scheduledStart !== undefined)  data.scheduledStart = input.scheduledStart;
    if (input.scheduledEnd !== undefined)    data.scheduledEnd = input.scheduledEnd;
    if (input.timezone !== undefined)        data.timezone = input.timezone;
    if (input.pocName !== undefined)         data.pocName = input.pocName;
    if (input.pocTitle !== undefined)        data.pocTitle = input.pocTitle;
    if (input.pocEmail !== undefined)        data.pocEmail = input.pocEmail;
    if (input.pocPhone !== undefined)        data.pocPhone = input.pocPhone;
    if (input.pocCanAuthorize !== undefined) data.pocCanAuthorize = input.pocCanAuthorize;
    if (input.clientType !== undefined)      data.clientType = input.clientType;
    if (input.notesForVcio !== undefined)    data.notesForVcio = input.notesForVcio;
    if (input.vcioUserId !== undefined)      data.vcioUserId = input.vcioUserId;

    const materialChange =
      input.scheduledDate !== undefined ||
      input.scheduledStart !== undefined ||
      input.pocName !== undefined ||
      input.pocEmail !== undefined ||
      input.clientType !== undefined;
    if (materialChange && existing.status === SiteSurveyStatus.ACCEPTED) {
      data.status = SiteSurveyStatus.AWAITING_VCIO_ACCEPT;
      data.vcioAcceptedAt = null;
    }

    const survey = await prisma.siteSurvey.update({ where: { id: existing.id }, data });
    await writeAudit({
      actorUserId: user.id,
      entityType: "SiteSurvey",
      entityId: survey.id,
      action: "UPDATE",
      before: { status: existing.status },
      after: { status: survey.status, fieldsChanged: Object.keys(data) },
      ...getAuditContext(req),
    });
    return NextResponse.json({ siteSurvey: survey });
  } catch (err) {
    return jsonError(err);
  }
}
