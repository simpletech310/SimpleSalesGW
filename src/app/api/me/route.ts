import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { getAuditContext, jsonError, requireSessionUser } from "@/lib/api";

/**
 * PATCH /api/me — let the signed-in user edit their own basic profile
 * fields: name, phone. Email + role are intentionally read-only here
 * (role changes go through Admin → Users; email is the auth identity).
 *
 * v3.0.5 — created alongside the redesigned /me profile page.
 */
const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z
    .string()
    .max(40)
    .optional()
    .or(z.literal("")),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireSessionUser();
    const json = await req.json();
    const data = patchSchema.parse(json);

    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, phone: true },
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    await writeAudit({
      actorUserId: user.id,
      entityType: "User",
      entityId: user.id,
      action: "UPDATE",
      before: before as unknown as Record<string, unknown>,
      after: { name: updated.name, phone: updated.phone } as Record<string, unknown>,
      ...getAuditContext(req),
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    return jsonError(err);
  }
}
