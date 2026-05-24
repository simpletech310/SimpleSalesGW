import { NextResponse } from "next/server";
import { z } from "zod";
import { CallSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { deleteRoom } from "@/lib/daily/client";

const endSchema = z.object({
  sessionId: z.string().uuid(),
  durationSeconds: z.number().int().nonnegative().optional(),
});

/**
 * v2.22 — POST /api/leads/[id]/calls/end
 *
 * Closes a SalesCallSession + updates the linked Activity row with
 * duration. Best-effort deletes the Daily room (silent on failure).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id: leadId } = await params;
    const body = endSchema.parse(await req.json());

    const session = await prisma.salesCallSession.findUnique({
      where: { id: body.sessionId },
      select: { id: true, leadId: true, status: true, dailyRoomName: true, activityId: true, startedAt: true, initiatorUserId: true },
    });
    if (!session) throw new ApiError(404, "Session not found");
    if (session.leadId !== leadId) throw new ApiError(400, "Lead/session mismatch");
    if (session.initiatorUserId !== user.id) {
      throw new ApiError(403, "Only the call initiator can end the session");
    }

    if (session.status === CallSessionStatus.ENDED) {
      return NextResponse.json({ ok: true, alreadyEnded: true });
    }

    const now = new Date();
    const dur = body.durationSeconds ?? Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000));

    await prisma.salesCallSession.update({
      where: { id: session.id },
      data: { status: CallSessionStatus.ENDED, endedAt: now, durationSeconds: dur },
    });

    if (session.activityId) {
      const min = Math.floor(dur / 60);
      const sec = dur % 60;
      await prisma.activity.update({
        where: { id: session.activityId },
        data: { body: `Call ended — duration ${min}m ${sec}s` },
      });
    }

    // Best-effort cleanup of the Daily room
    try { await deleteRoom(session.dailyRoomName); } catch { /* ignore */ }

    return NextResponse.json({ ok: true, durationSeconds: dur });
  } catch (err) {
    return jsonError(err);
  }
}
