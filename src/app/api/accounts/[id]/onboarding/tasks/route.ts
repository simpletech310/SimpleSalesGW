import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { canSeeCustomer } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { lead: { select: { ownerUserId: true } } },
    });
    if (!customer) throw new ApiError(404, "Customer not found");
    if (!canSeeCustomer(user.role, user.id, customer.lead.ownerUserId)) {
      throw new ApiError(403, "Forbidden");
    }
    const tasks = await prisma.onboardingTask.findMany({
      where: { customerId: id },
      orderBy: [{ phase: "asc" }, { position: "asc" }],
      include: { owner: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ tasks });
  } catch (err) {
    return jsonError(err);
  }
}
