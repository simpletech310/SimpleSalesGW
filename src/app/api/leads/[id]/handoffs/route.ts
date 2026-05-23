import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:view:all")) {
      throw new ApiError(403, "Forbidden");
    }
    const handoffs = await prisma.handoff.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      include: {
        initiator: { select: { name: true } },
        acceptor: { select: { name: true } },
      },
    });
    return NextResponse.json({ handoffs });
  } catch (err) {
    return jsonError(err);
  }
}
