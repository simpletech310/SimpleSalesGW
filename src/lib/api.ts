import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RbacError } from "@/lib/rbac";
import type { Role } from "@prisma/client";

export type ApiUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function requireSessionUser(): Promise<ApiUser> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new ApiError(401, "Unauthorized");
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) throw new ApiError(401, "Unauthorized");
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof RbacError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: err.flatten() },
      { status: 400 },
    );
  }
  // eslint-disable-next-line no-console
  console.error("[api] unexpected", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function getAuditContext(req: Request) {
  return {
    ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  };
}
