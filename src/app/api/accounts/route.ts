import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSessionUser } from "@/lib/api";
import { customerVisibilityFilter } from "@/lib/rbac";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const customers = await prisma.customer.findMany({
      where: customerVisibilityFilter(user.role, user.id),
      include: {
        lead: { select: { id: true, businessName: true, industry: true, primaryContactName: true, ownerUserId: true } },
        accountManager: { select: { id: true, name: true } },
        _count: { select: { onboardingTasks: true, qbrs: true, discoveryAssessments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ customers });
  } catch (err) {
    return jsonError(err);
  }
}
