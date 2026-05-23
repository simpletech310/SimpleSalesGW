import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can, canSeeCustomer } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import {
  INVENTORY_ENTITIES,
  INVENTORY_FIELDS,
  coerceForWrite,
  delegateFor,
  type InventoryEntityKey,
} from "@/lib/inventory/types";

function isEntityKey(s: string): s is InventoryEntityKey {
  return (INVENTORY_ENTITIES as string[]).includes(s);
}

async function authorizeOnCustomer(customerId: string, write: boolean) {
  const user = await requireSessionUser();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { lead: { select: { ownerUserId: true } } },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
    throw new ApiError(403, "Forbidden");
  }
  if (write && !can(user.role, "onboarding:manage")) {
    throw new ApiError(403, "Write requires onboarding:manage permission");
  }
  return user;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; entity: string }> }) {
  try {
    const { id, entity } = await params;
    if (!isEntityKey(entity)) throw new ApiError(400, "Unknown inventory entity");
    await authorizeOnCustomer(id, false);
    const delegate = delegateFor(entity, prisma);
    // Cast: each delegate supports findMany({ where: { customerId } }).
    const rows = await (delegate as { findMany: (args: unknown) => Promise<unknown[]> }).findMany({
      where: { customerId: id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ rows });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; entity: string }> }) {
  try {
    const { id, entity } = await params;
    if (!isEntityKey(entity)) throw new ApiError(400, "Unknown inventory entity");
    const user = await authorizeOnCustomer(id, true);

    const fields = INVENTORY_FIELDS[entity];
    const body = (await req.json()) as Record<string, unknown>;

    // 1. Validate raw input presence first (don't let coercion mask absence).
    for (const f of fields) {
      if (!f.required) continue;
      const raw = body[f.key];
      const missing =
        raw === undefined ||
        raw === null ||
        (typeof raw === "string" && raw.trim() === "") ||
        (Array.isArray(raw) && raw.length === 0);
      if (missing) {
        throw new ApiError(400, `${f.label} is required`);
      }
    }

    // 2. Coerce + sanity-check the result. Numeric/decimal fields that parsed
    //    to NaN, or date fields that parsed to Invalid Date, are reported.
    const data: Record<string, unknown> = { customerId: id };
    for (const f of fields) {
      if (body[f.key] === undefined) continue;
      const coerced = coerceForWrite(f, body[f.key]);
      if ((f.type === "number" || f.type === "decimal") && typeof coerced === "number" && Number.isNaN(coerced)) {
        throw new ApiError(400, `${f.label} must be a number`);
      }
      if (f.type === "decimal" && coerced && typeof coerced === "object" && "d" in (coerced as object) === false && f.required) {
        // Prisma.Decimal sanity — fall through; Prisma will throw if shape is bad.
      }
      if (f.type === "date" && coerced instanceof Date && Number.isNaN(coerced.getTime())) {
        throw new ApiError(400, `${f.label} must be a valid date`);
      }
      data[f.key] = coerced;
    }
    // 3. Defensive re-check: required fields must be non-null post-coercion.
    for (const f of fields) {
      if (f.required && (data[f.key] === null || data[f.key] === undefined)) {
        throw new ApiError(400, `${f.label} is required`);
      }
    }

    const delegate = delegateFor(entity, prisma);
    const created = await (delegate as { create: (args: unknown) => Promise<{ id: string }> }).create({ data });

    await writeAudit({
      actorUserId: user.id,
      entityType: `Inventory:${entity}`,
      entityId: created.id,
      action: "CREATE",
      after: data as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ row: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
