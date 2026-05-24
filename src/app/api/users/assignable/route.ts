import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";

/**
 * GET /api/users/assignable
 *
 * Returns a lightweight list of active users suitable for owner / account-
 * manager pickers. Available to any role that needs to reassign work
 * (onboarding:manage covers SALES_MANAGER, VCIO, COO, SUPERADMIN). Returns
 * only id + name + role + email — no permissions, no sensitive fields.
 *
 * Query param `?roles=VCIO,COO` restricts to specific roles.
 */
export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    if (!can(user.role, "onboarding:manage") && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }
    const url = new URL(req.url);
    const rolesRaw = url.searchParams.get("roles");
    const allowedRoles = new Set<string>(Object.values(Role));
    const filterRoles = rolesRaw
      ? rolesRaw.split(",").map((r) => r.trim().toUpperCase()).filter((r) => allowedRoles.has(r))
      : null;

    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(filterRoles && filterRoles.length > 0 ? { role: { in: filterRoles as Role[] } } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ users });
  } catch (err) {
    return jsonError(err);
  }
}
