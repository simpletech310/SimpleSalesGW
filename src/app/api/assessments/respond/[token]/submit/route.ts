import { NextResponse } from "next/server";
import { getAuditContext, jsonError } from "@/lib/api";
import { resolveToken } from "@/lib/assessment/tokens";
import { submitAssessment } from "@/lib/assessment/submit";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const res = await resolveToken(token);
    if (!res.ok) {
      return NextResponse.json({ error: res.reason }, { status: 410 });
    }
    // Respondent is anonymous from the system's perspective; we credit the
    // assessment creator as the actor in scoring activity, but record IP/UA.
    await submitAssessment(res.assessmentId, {
      actorUserId: null,
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
