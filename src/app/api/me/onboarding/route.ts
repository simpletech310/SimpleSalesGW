import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSessionUser } from "@/lib/api";

/**
 * GET  /api/me/onboarding — current user's UserPreference (lazy-created).
 * POST /api/me/onboarding — { flowKey } to mark a flow as seen.
 */

const postSchema = z.object({
  flowKey: z.string().min(1).max(120),
});

async function ensurePrefs(userId: string) {
  return prisma.userPreference.upsert({
    where: { userId },
    update: {},
    create: { userId, onboardingSeen: [], preferences: {} },
  });
}

export async function GET() {
  try {
    const user = await requireSessionUser();
    const prefs = await ensurePrefs(user.id);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    const { flowKey } = postSchema.parse(await req.json());
    const prefs = await ensurePrefs(user.id);
    if (prefs.onboardingSeen.includes(flowKey)) {
      return NextResponse.json({ preferences: prefs });
    }
    const updated = await prisma.userPreference.update({
      where: { userId: user.id },
      data: { onboardingSeen: { push: flowKey } },
    });
    return NextResponse.json({ preferences: updated });
  } catch (err) {
    return jsonError(err);
  }
}
