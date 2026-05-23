import { NextResponse } from "next/server";
import { getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { submitAssessment } from "@/lib/assessment/submit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const { scoring } = await submitAssessment(id, {
      actorUserId: user.id,
      ...getAuditContext(req),
    });
    return NextResponse.json({ scoring });
  } catch (err) {
    return jsonError(err);
  }
}
