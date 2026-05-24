import { NextResponse } from "next/server";
import { CallSessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * v2.22 — Daily.co webhook receiver (stub for v2.23 recording).
 *
 * Daily POSTs call lifecycle events here. We log and (for ENDED-style
 * events) close the session row. Recording URL handling is stubbed —
 * when the test plan is upgraded to a paid one with recording, the
 * recording.ready event will fire with a `recording.url` we persist
 * on the session + linked Activity.
 *
 * Daily does NOT sign webhooks by default; if exposed publicly, gate
 * via a shared secret in a query-string token. For v2.22 we accept
 * anonymous posts but only act on events that reference a known room.
 */
export async function POST(req: Request) {
  try {
    const event = (await req.json()) as {
      type?: string;
      payload?: { room?: string; recording_url?: string; duration?: number };
    };

    const type = event?.type ?? "";
    const roomName = event?.payload?.room;
    if (!roomName) return NextResponse.json({ ok: true, ignored: "no room" });

    const session = await prisma.salesCallSession.findUnique({
      where: { dailyRoomName: roomName },
      select: { id: true, status: true, activityId: true },
    });
    if (!session) return NextResponse.json({ ok: true, ignored: "unknown room" });

    // meeting.ended → mark ENDED
    if (type === "meeting.ended" || type === "room.deleted") {
      if (session.status !== CallSessionStatus.ENDED) {
        const dur = typeof event.payload?.duration === "number" ? event.payload.duration : null;
        await prisma.salesCallSession.update({
          where: { id: session.id },
          data: {
            status: CallSessionStatus.ENDED,
            endedAt: new Date(),
            ...(dur != null ? { durationSeconds: Math.floor(dur) } : {}),
          },
        });
      }
    }

    // recording.ready → persist URL (v2.23-ready)
    if (type === "recording.ready" && event.payload?.recording_url) {
      await prisma.salesCallSession.update({
        where: { id: session.id },
        data: { recordingUrl: event.payload.recording_url },
      });
      if (session.activityId) {
        await prisma.activity.update({
          where: { id: session.activityId },
          data: { body: `Recording: ${event.payload.recording_url}` },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[daily-webhook] failed:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
