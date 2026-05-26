import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { draftKickoffNarrative } from "@/lib/ai/kickoff-narrative";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    if (!can(actor.role, "kickoff:edit")) throw new ApiError(403, "Forbidden");
    const { id: customerId } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            industry: true,
            triggerEvent: true,
            primaryContactName: true,
            primaryContactTitle: true,
            executiveSponsorName: true,
            executiveSponsorTitle: true,
          },
        },
        discoveryAssessments: {
          where: { status: "COMPLETED" },
          select: { kind: true, scorecard: true },
          take: 5,
        },
      },
    });
    if (!customer) throw new ApiError(404, "Not found");

    const handoff = await prisma.handoff.findFirst({
      where: { leadId: customer.leadId },
      orderBy: { createdAt: "desc" },
    });

    const contacts: Array<{ name: string; title: string | null; role: string }> = [];
    if (customer.lead.primaryContactName) {
      contacts.push({ name: customer.lead.primaryContactName, title: customer.lead.primaryContactTitle, role: "Primary contact" });
    }
    if (customer.lead.executiveSponsorName) {
      contacts.push({ name: customer.lead.executiveSponsorName, title: customer.lead.executiveSponsorTitle, role: "Executive sponsor" });
    }

    const result = await draftKickoffNarrative(
      {
        customer: { businessName: customer.lead.businessName, industry: customer.lead.industry },
        sourceLead: {
          triggerEvent: customer.lead.triggerEvent,
          statedPain: handoff?.statedPain ?? null,
        },
        contacts,
        discoveryHighlights: customer.discoveryAssessments.map((d) =>
          `${d.kind}: ${JSON.stringify(d.scorecard ?? {}).slice(0, 300)}`,
        ),
        commitments: {
          sowSummary: "(SOW summary from latest proposal — TODO wire when present)",
          day30QuickWin: handoff?.day30QuickWin ?? null,
        },
      },
      { leadId: customer.leadId, userId: actor.id },
    );

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
