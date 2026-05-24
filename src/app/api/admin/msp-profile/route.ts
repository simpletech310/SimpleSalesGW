import { NextResponse } from "next/server";
import { z } from "zod";
import { Industry, ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { invalidateProfileCache } from "@/lib/msp/loader";

/**
 * v2.21 — POST /api/admin/msp-profile
 *
 * Persists the MSP business profile (mission, voice, services emphasis,
 * win stories) as a single SystemConfig blob keyed `msp.profile`.
 * Mirrors src/app/api/admin/pricing/route.ts. SUPERADMIN only.
 */

const serviceLineProfileSchema = z.object({
  serviceLine: z.nativeEnum(ServiceLine),
  emphasis: z.enum(["focus", "normal", "de-emphasize"]),
  note: z.string().max(200).optional(),
});

const winStorySchema = z.object({
  industry: z.union([z.nativeEnum(Industry), z.literal("ANY")]),
  situation: z.string().min(1).max(500),
  outcome: z.string().min(1).max(500),
});

const profileSchema = z.object({
  // v2.21 — version is rewritten server-side on every save (ISO
  // timestamp), so the client's value is ignored. Keep optional for
  // round-trip compatibility.
  version: z.string().optional(),
  companyName: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  tagline: z.string().max(300).default(""),
  missionStatement: z.string().max(2000).default(""),
  brandVoice: z.string().max(2000).default(""),
  background: z.string().max(4000).default(""),
  differentiators: z.array(z.string().max(300)).max(20).default([]),
  targetMarkets: z.array(z.string().max(100)).max(20).default([]),
  services: z.array(serviceLineProfileSchema).max(20),
  outOfScope: z.array(z.string().max(300)).max(20).default([]),
  winStories: z.array(winStorySchema).max(30).default([]),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "msp:profile:edit")) throw new ApiError(403, "Forbidden");
    const parsed = profileSchema.parse(await req.json());

    // Stamp version with ISO timestamp so cache + audit have a clear
    // monotonic identifier.
    const value = { ...parsed, version: new Date().toISOString() };

    const row = await prisma.systemConfig.upsert({
      where: { key: "msp.profile" },
      update: { value: value as never },
      create: { key: "msp.profile", value: value as never },
    });

    // Force-clear the in-memory cache so the next Claude call across
    // every AI feature picks up the new profile.
    invalidateProfileCache();

    await writeAudit({
      actorUserId: user.id,
      entityType: "SystemConfig",
      entityId: row.id,
      action: "UPDATE",
      after: {
        key: "msp.profile",
        version: value.version,
        companyName: value.companyName,
        servicesFocused: value.services.filter((s) => s.emphasis === "focus").length,
        winStoryCount: value.winStories.length,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true, version: value.version });
  } catch (err) {
    return jsonError(err);
  }
}
