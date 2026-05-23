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

    // Build the create data payload from defined fields only.
    const data: Record<string, unknown> = { customerId: id };
    for (const f of fields) {
      if (body[f.key] !== undefined) data[f.key] = coerceForWrite(f, body[f.key]);
    }
    // Required-field check
    for (const f of fields) {
      if (f.required && (data[f.key] === null || data[f.key] === undefined || data[f.key] === "")) {
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
