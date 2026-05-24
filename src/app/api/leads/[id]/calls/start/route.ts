import { NextResponse } from "next/server";
import { z } from "zod";
import { ActivityType, CallSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { leadIsVisible } from "@/lib/rbac";
import { userTeamIds } from "@/lib/sales/teams";
import {
  DailyNotConfiguredError,
  createMeetingToken,
  createRoom,
  newRoomName,
} from "@/lib/daily/client";
import { writeAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const startSchema = z.object({
  kind: z.enum(["VIDEO_CALL", "AUDIO_CALL"]).default("VIDEO_CALL"),
});

/**
 * v2.22 — POST /api/leads/[id]/calls/start
 *
 * Create a Daily room + tokens for the rep (owner) and a guest URL
 * for the customer. Persists a SalesCallSession + an Activity row.
 * Returns the room URL + rep token + guest URL.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id: leadId } = await params;

    if (!env().DAILY_API_KEY) {
      throw new DailyNotConfiguredError();
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        ownerUserId: true,
        pipelineStage: true,
        teamId: true,
        businessName: true,
        primaryContactName: true,
      },
    });
    if (!lead) throw new ApiError(404, "Lead not found");

    const teams = await userTeamIds(user.id);
    if (!leadIsVisible(user.role, user.id, lead.ownerUserId, lead.pipelineStage, lead.teamId, teams)) {
      throw new ApiError(403, "Forbidden");
    }

    const body = startSchema.parse(await req.json().catch(() => ({})));
    const kind = body.kind === "AUDIO_CALL" ? ActivityType.AUDIO_CALL : ActivityType.VIDEO_CALL;

    const roomName = newRoomName(leadId);
    const room = await createRoom({
      name: roomName,
      properties: kind === ActivityType.AUDIO_CALL
        ? { start_video_off: true, start_audio_off: false }
        : undefined,
    });

    const [repToken, guestToken] = await Promise.all([
      createMeetingToken({ roomName, userName: user.name, isOwner: true }),
      createMeetingToken({
        roomName,
        userName: lead.primaryContactName ?? lead.businessName,
        isOwner: false,
      }),
    ]);

    // Persist session + linked activity in a transaction
    const session = await prisma.salesCallSession.create({
      data: {
        leadId,
        initiatorUserId: user.id,
        dailyRoomName: roomName,
        dailyRoomUrl: room.url,
        kind,
        status: CallSessionStatus.ACTIVE,
      },
    });

    const activity = await prisma.activity.create({
      data: {
        leadId,
        actorUserId: user.id,
        type: kind,
        subject: `${kind === ActivityType.AUDIO_CALL ? "Audio" : "Video"} call started`,
        body: `Room: ${room.url}`,
      },
    });

    await prisma.salesCallSession.update({
      where: { id: session.id },
      data: { activityId: activity.id },
    });

    const guestUrl = `${room.url}?t=${guestToken}`;

    await writeAudit({
      actorUserId: user.id,
      entityType: "SalesCallSession",
      entityId: session.id,
      action: "CREATE",
      after: { leadId, kind, roomName },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      sessionId: session.id,
      activityId: activity.id,
      roomUrl: room.url,
      repToken,
      guestUrl,
    });
  } catch (err) {
    if (err instanceof DailyNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return jsonError(err);
  }
}
