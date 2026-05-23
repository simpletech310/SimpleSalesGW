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

async function authorize(customerId: string) {
  const user = await requireSessionUser();
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { lead: { select: { ownerUserId: true } } },
  });
  if (!customer) throw new ApiError(404, "Customer not found");
  if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
    throw new ApiError(403, "Forbidden");
  }
  if (!can(user.role, "onboarding:manage")) {
    throw new ApiError(403, "Write requires onboarding:manage permission");
  }
  return user;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; entity: string; rowId: string }> }) {
  try {
    const { id, entity, rowId } = await params;
    if (!isEntityKey(entity)) throw new ApiError(400, "Unknown inventory entity");
    const user = await authorize(id);

    const fields = INVENTORY_FIELDS[entity];
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      if (body[f.key] !== undefined) data[f.key] = coerceForWrite(f, body[f.key]);
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: true, noop: true });
    }

    const delegate = delegateFor(entity, prisma);
    const updated = await (delegate as { update: (args: unknown) => Promise<{ id: string }> }).update({
      where: { id: rowId },
      data,
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: `Inventory:${entity}`,
      entityId: rowId,
      action: "UPDATE",
      after: data as never,
      ...getAuditContext(req),
    });

    return NextResponse.json({ row: updated });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; entity: string; rowId: string }> }) {
  try {
    const { id, entity, rowId } = await params;
    if (!isEntityKey(entity)) throw new ApiError(400, "Unknown inventory entity");
    const user = await authorize(id);
    const delegate = delegateFor(entity, prisma);
    await (delegate as { delete: (args: unknown) => Promise<unknown> }).delete({ where: { id: rowId } });
    await writeAudit({
      actorUserId: user.id,
      entityType: `Inventory:${entity}`,
      entityId: rowId,
      action: "DELETE",
      ...getAuditContext(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
