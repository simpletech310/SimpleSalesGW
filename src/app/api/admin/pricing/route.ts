import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceBundle, ServiceLine } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { invalidateCatalogCache } from "@/lib/pricing/loader";

const seatTierSchema = z.object({
  minSeats: z.coerce.number().int().min(1),
  maxSeats: z.coerce.number().int().min(1),
  perSeatMrr: z.coerce.number().nonnegative(),
  perSeatFloor: z.coerce.number().nonnegative(),
});

const bundleSchema = z.object({
  id: z.nativeEnum(ServiceBundle),
  label: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  seatTiers: z.array(seatTierSchema),
  onboarding: z.object({
    base: z.coerce.number().nonnegative(),
    perSeat: z.coerce.number().nonnegative(),
  }),
  annualAddOns: z.array(z.object({ label: z.string(), amount: z.coerce.number().nonnegative() })).optional(),
  includes: z.array(z.nativeEnum(ServiceLine)),
});

const standaloneSchema = z.object({
  perSeatMrr: z.coerce.number().nonnegative(),
  perSeatFloor: z.coerce.number().nonnegative(),
  oneTime: z.coerce.number().nonnegative(),
});

const catalogSchema = z.object({
  version: z.string().min(1).max(100),
  currency: z.literal("USD"),
  bundles: z.record(z.nativeEnum(ServiceBundle), bundleSchema),
  standalone: z.record(z.nativeEnum(ServiceLine), standaloneSchema.optional()),
});

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "system:config")) throw new ApiError(403, "Forbidden");
    const data = catalogSchema.parse(await req.json());

    const row = await prisma.systemConfig.upsert({
      where: { key: "pricing.catalog" },
      update: { value: data as never },
      create: { key: "pricing.catalog", value: data as never },
    });
    invalidateCatalogCache();

    await writeAudit({
      actorUserId: user.id,
      entityType: "SystemConfig",
      entityId: row.id,
      action: "UPDATE",
      after: { key: "pricing.catalog", version: data.version },
      ...getAuditContext(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
