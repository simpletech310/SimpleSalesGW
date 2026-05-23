import { NextResponse } from "next/server";
import { OnboardingTaskStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSessionUser } from "@/lib/api";

/**
 * GET /api/my-tasks — current user's onboarding work across all customers.
 *
 * - SALESPERSON: returns only tasks directly assigned (ownerUserId = me).
 * - VCIO / SALES_MANAGER / COO / SUPERADMIN: returns tasks where they're the
 *   assigned owner OR the defaultRole matches their role (so unassigned
 *   role-appropriate work surfaces too).
 *
 * Query params:
 *   ?role=VCIO   - lens an authorized user into another role's view.
 *                  Only SUPERADMIN can lens to any role; everyone else is
 *                  restricted to their own role.
 *   ?includeDone=true — include DONE/SKIPPED in the list. Default excludes.
 */
export async function GET(req: Request) {
  try {
    const user = await requireSessionUser();
    const url = new URL(req.url);
    const lensRaw = url.searchParams.get("role");
    const includeDone = url.searchParams.get("includeDone") === "true";

    let lens: Role = user.role;
    if (lensRaw && (Object.values(Role) as string[]).includes(lensRaw)) {
      if (user.role === Role.SUPERADMIN) lens = lensRaw as Role;
      else if ((lensRaw as Role) === user.role) lens = user.role;
      else lens = user.role; // ignore unauthorized lens attempts
    }

    const tasks = await prisma.onboardingTask.findMany({
      where: {
        ...(includeDone
          ? {}
          : { status: { notIn: [OnboardingTaskStatus.DONE, OnboardingTaskStatus.SKIPPED] } }),
        OR: [
          { ownerUserId: user.id },
          // For role views: defaultRole matches lens AND no specific owner yet
          ...(lens === Role.SALESPERSON
            ? []
            : [{ ownerRole: lens, ownerUserId: null }]),
        ],
      },
      orderBy: [{ dueAt: "asc" }, { phase: "asc" }, { position: "asc" }],
      include: {
        customer: {
          select: { id: true, lead: { select: { businessName: true } } },
        },
        owner: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ tasks, lens, userRole: user.role });
  } catch (err) {
    return jsonError(err);
  }
}
