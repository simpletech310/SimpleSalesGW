import { NextResponse } from "next/server";
import { ResearchArtifactType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, getAuditContext, jsonError, requireSessionUser } from "@/lib/api";
import { can } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { fetchPage } from "@/lib/scrape/fetch-page";
import { fetchLinkedInCompany } from "@/lib/scrape/linkedin";
import { fetchGoogleBusiness } from "@/lib/scrape/google-business";
import { summarizeResearch } from "@/lib/ai/research-summary";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

type SourceResult = { ok: boolean; artifactId?: string; reason?: string };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ApiError(404, "Lead not found");
    if (lead.ownerUserId !== user.id && !can(user.role, "lead:edit:any")) {
      throw new ApiError(403, "Forbidden");
    }

    const sources: Record<"website" | "linkedin" | "google", SourceResult> = {
      website: { ok: false, reason: "no_url" },
      linkedin: { ok: false, reason: "no_url" },
      google: { ok: false, reason: "no_url" },
    };

    if (lead.websiteUrl) {
      const res = await fetchPage(lead.websiteUrl);
      if (res.ok) {
        const art = await prisma.researchArtifact.create({
          data: {
            leadId: lead.id,
            type: ResearchArtifactType.WEBSITE_SNAPSHOT,
            sourceUrl: res.url,
            payload: {
              source: "website",
              finalUrl: res.finalUrl,
              title: res.page.title,
              metaTags: res.page.metaTags,
              plainText: res.page.plainText,
              bytes: res.bytes,
            } as never,
          },
        });
        sources.website = { ok: true, artifactId: art.id };
      } else {
        sources.website = { ok: false, reason: res.reason };
      }
    }

    if (lead.linkedinCompanyUrl) {
      const res = await fetchLinkedInCompany(lead.linkedinCompanyUrl);
      if (res.ok) {
        const art = await prisma.researchArtifact.create({
          data: {
            leadId: lead.id,
            type: ResearchArtifactType.LINKEDIN_LINK,
            sourceUrl: lead.linkedinCompanyUrl,
            payload: res.payload as never,
          },
        });
        sources.linkedin = { ok: true, artifactId: art.id };
      } else {
        sources.linkedin = { ok: false, reason: res.reason };
      }
    }

    if (lead.googleBusinessUrl) {
      const res = await fetchGoogleBusiness(lead.googleBusinessUrl);
      if (res.ok) {
        const art = await prisma.researchArtifact.create({
          data: {
            leadId: lead.id,
            type: ResearchArtifactType.GOOGLE_BUSINESS_DATA,
            sourceUrl: lead.googleBusinessUrl,
            payload: res.payload as never,
          },
        });
        sources.google = { ok: true, artifactId: art.id };
      } else {
        sources.google = { ok: false, reason: res.reason };
      }
    }

    // Then ask Claude for a unified summary if any source succeeded and Claude is configured.
    let summary: string | null = null;
    let suggestedQuestions: string[] = [];
    let risks: string[] = [];
    let fitSignals: string[] = [];
    const anySucceeded = Object.values(sources).some((s) => s.ok);
    if (anySucceeded && isAnthropicConfigured()) {
      const fresh = await prisma.lead.findUnique({
        where: { id },
        include: { researchArtifacts: { orderBy: { createdAt: "desc" }, take: 8 } },
      });
      if (fresh) {
        const result = await summarizeResearch({
          lead: {
            businessName: fresh.businessName,
            industry: fresh.industry,
            seatCount: fresh.seatCount,
            siteCount: fresh.siteCount,
            addressCity: fresh.addressCity,
            addressState: fresh.addressState,
            websiteUrl: fresh.websiteUrl,
            linkedinCompanyUrl: fresh.linkedinCompanyUrl,
            googleBusinessUrl: fresh.googleBusinessUrl,
            primaryContactName: fresh.primaryContactName,
            primaryContactTitle: fresh.primaryContactTitle,
            executiveSponsorName: fresh.executiveSponsorName,
            currentMspName: fresh.currentMspName,
            currentMspSatisfaction: fresh.currentMspSatisfaction,
            complianceDrivers: fresh.complianceDrivers,
            researchSummary: fresh.researchSummary,
          },
          artifacts: fresh.researchArtifacts.map((a) => ({
            type: a.type,
            sourceUrl: a.sourceUrl,
            payload: a.payload,
          })),
        });
        await prisma.$transaction([
          prisma.researchArtifact.create({
            data: {
              leadId: id,
              type: ResearchArtifactType.CLAUDE_SUMMARY,
              payload: result as never,
              sourceUrl: null,
            },
          }),
          prisma.lead.update({
            where: { id },
            data: { researchSummary: result.summary, researchCompletedAt: new Date() },
          }),
        ]);
        summary = result.summary;
        suggestedQuestions = result.suggestedQuestions;
        risks = result.risks;
        fitSignals = result.fitSignals;
      }
    }

    await writeAudit({
      actorUserId: user.id,
      entityType: "Lead",
      entityId: id,
      action: "UPDATE",
      after: { researchGathered: true, sources },
      ...getAuditContext(req),
    });

    return NextResponse.json({ sources, summary, suggestedQuestions, risks, fitSignals });
  } catch (err) {
    return jsonError(err);
  }
}
