import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, requireSessionUser } from "@/lib/api";
import { detectTriggerEvent } from "@/lib/ai/trigger-event-detect";

const bodySchema = z.object({ researchNotes: z.string().max(20000).optional() });

/**
 * Suggest a TriggerEvent from research notes. Lead-id is in the URL so the
 * call is metered against the per-lead AI cap if the lead already exists;
 * passing /api/leads/_new/ai-trigger-detect (or any unresolved id) treats
 * the call as org-only metered.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSessionUser();
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    let notes = body.researchNotes ?? "";
    let leadId: string | undefined;
    if (id !== "_new") {
      const lead = await prisma.lead.findUnique({
        where: { id },
        select: { id: true, researchSummary: true },
      });
      if (lead) {
        leadId = lead.id;
        if (!notes && lead.researchSummary) notes = lead.researchSummary;
      }
    }

    const result = await detectTriggerEvent({ researchNotes: notes }, { leadId, userId: actor.id });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
