import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.nativeEnum(Role),
  password: z.string().min(8).max(120).optional(),
  active: z.boolean().default(true),
});

export async function GET() {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "user:manage")) throw new ApiError(403, "Forbidden");
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "user:manage")) throw new ApiError(403, "Forbidden");
    const data = createSchema.parse(await req.json());
    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    const created = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        active: data.active,
        passwordHash,
      },
    });
    await writeAudit({
      actorUserId: user.id,
      entityType: "User",
      entityId: created.id,
      action: "CREATE",
      after: { email: created.email, role: created.role, active: created.active },
      ...getAuditContext(req),
    });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
