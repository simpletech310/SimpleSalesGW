/**
 * v3.3.28 — Gather research via agentic OSINT loop.
 *
 * Replaces the v3.3.27-and-earlier 3-fetcher (website / LinkedIn / Google
 * Business). New flow:
 *   1. runResearchAgent does seed-scrape (free) + Claude tool-use loop
 *      with web_search / fetch_url / find_emails. Each tool call
 *      auto-persists a ResearchArtifact row.
 *   2. applyEnrichmentToLead writes the resulting briefing onto Lead row
 *      using non-null-overwrite semantics — fields the agent didn't find
 *      stay as they were (protecting any manual data).
 *   3. Toast on the client shows tool-call counts + source provider.
 *
 * Fall-back behavior: if the agent loop fails (Anthropic outage, JSON
 * parse fail, etc.), we still return the seed-scrape's regex-harvested
 * intel so the UI shows _something_ and the rep can click "Summarize
 * with Gateway AI" to retry.
 *
 * LinkedIn is no longer fetched server-side — relabeled as a manual
 * reference URL on the lead form. ToS-compliant + no more silent 403s.
 */

import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { AiBudgetExceededError } from "@/lib/ai/budget";
import { runResearchAgent } from "@/lib/lead-enrich/agent";
import { applyEnrichmentToLead } from "@/lib/lead-enrich/persist";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    // ---- Run the agent ----
    const agentResult = await runResearchAgent({
      lead: {
        id: lead.id,
        businessName: lead.businessName,
        industry: lead.industry,
        websiteUrl: lead.websiteUrl,
        addressCity: lead.addressCity,
        addressState: lead.addressState,
        seatCount: lead.seatCount,
        siteCount: lead.siteCount,
        primaryContactName: lead.primaryContactName,
      },
      userId: user.id,
    });

    // ---- Persist the briefing (non-null overwrite) ----
    let persistDiff = { updatedFields: [] as string[], skippedFields: [] as string[] };
    if (agentResult.briefing) {
      // Persist a final AGENT_BRIEFING artifact for audit + the
      // Research-tab Artifacts list.
      try {
        await prisma.researchArtifact.create({
          data: {
            leadId: lead.id,
            type: ResearchArtifactType.AGENT_BRIEFING,
            sourceUrl: null,
            payload: {
              rounds: agentResult.rounds,
              stopReason: agentResult.stopReason,
              briefing: agentResult.briefing,
            } as never,
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[gather] AGENT_BRIEFING artifact write failed:", (err as Error).message);
      }

      const applied = await applyEnrichmentToLead(lead.id, agentResult.briefing, {
        source: "agent_loop",
      });
      persistDiff = applied.diff;
    }

    // ---- Sources summary (back-compat with the existing toast contract) ----
    // The old UI inspected `sources.{website,linkedin,google}.ok`. We
    // synthesize an equivalent shape from the seed-scrape's per-page log
    // so the existing toast still works without UI changes.
    const sources = synthesizeSourcesSummary(agentResult.seedResult);

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      after: {
        researchGathered: true,
        agentRounds: agentResult.rounds,
        stopReason: agentResult.stopReason,
        sourcesScraped: agentResult.seedResult.sourcesUsed.length,
        fieldsUpdated: persistDiff.updatedFields.length,
      },
      ...getAuditContext(req),
    });

    return NextResponse.json({
      sources,
      // Backward-compat top-level fields consumed by LeadTabs.tsx ResearchTab
      summary: agentResult.briefing?.summary ?? null,
      suggestedQuestions: agentResult.briefing?.suggestedQuestions ?? [],
      risks: agentResult.briefing?.risks ?? [],
      fitSignals: agentResult.briefing?.fitSignals ?? [],
      // New telemetry for the toast / debug overlays
      agent: {
        configured: isAnthropicConfigured(),
        rounds: agentResult.rounds,
        stopReason: agentResult.stopReason,
        updatedFields: persistDiff.updatedFields,
      },
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { error: err.message, scope: err.scope, reason: err.reason },
        { status: 429 },
      );
    }
    return jsonError(err);
  }
}

// ---------------------------------------------------------------------------
// Shape the seed-scrape per-page log into the legacy {website,linkedin,google}
// counts the existing UI toast expects. Anything other than the homepage
// rolls up as additional successful sources; LinkedIn is always reported
// as "skipped" since we no longer fetch it server-side.
// ---------------------------------------------------------------------------
function synthesizeSourcesSummary(seed: {
  sourcesUsed: Array<{ url: string; kind: string }>;
  sourcesFailed: Array<{ url: string; reason: string }>;
  homepage: string | null;
}): Record<"website" | "linkedin" | "google", { ok: boolean; reason?: string }> {
  const website = seed.homepage
    ? { ok: true }
    : {
        ok: false,
        reason:
          seed.sourcesFailed[0]?.reason ?? "no_url",
      };
  return {
    website,
    // LinkedIn is intentionally never fetched in v3.3.28 — the field on the
    // lead form is a manual reference URL only (ToS + always-403 reality).
    linkedin: { ok: false, reason: "manual_reference_only" },
    // Google Business is currently a candidate URL in the seed-scrape's
    // candidate list; if it succeeded we'd have a homepage. Report parity
    // with old contract: "no_url" if the lead has no google business URL.
    google: { ok: false, reason: "manual_reference_only" },
  };
}
