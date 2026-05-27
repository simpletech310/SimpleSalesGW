import { describe, expect, it } from "vitest";
import { PipelineStage, Role } from "@prisma/client";
import { VCIO_VISIBLE_STAGES, leadIsVisible, leadVisibilityFilter } from "@/lib/rbac";

const ME = "user-me";
const SOMEONE_ELSE = "user-other";

describe("leadVisibilityFilter", () => {
  it("SALESPERSON sees only their own leads (ownerUserId filter)", () => {
    const f = leadVisibilityFilter(Role.SALESPERSON, ME);
    expect(f).toEqual({ ownerUserId: ME });
  });

  it("SALES_MANAGER sees everything (empty filter)", () => {
    const f = leadVisibilityFilter(Role.SALES_MANAGER, ME);
    expect(f).toEqual({});
  });

  it("COO sees everything", () => {
    const f = leadVisibilityFilter(Role.COO, ME);
    expect(f).toEqual({});
  });

  it("SUPERADMIN sees everything", () => {
    const f = leadVisibilityFilter(Role.SUPERADMIN, ME);
    expect(f).toEqual({});
  });

  it("VCIO sees only Site Survey Scheduled+ leads", () => {
    const f = leadVisibilityFilter(Role.VCIO, ME);
    expect(f).toEqual({ pipelineStage: { in: VCIO_VISIBLE_STAGES } });
  });

  it("VCIO_VISIBLE_STAGES is exactly SITE_SURVEY_SCHEDULED → CLOSED_LOST", () => {
    expect(VCIO_VISIBLE_STAGES).toEqual([
      PipelineStage.SITE_SURVEY_SCHEDULED,
      PipelineStage.DISCOVERY,
      PipelineStage.QUOTE_IN_PROGRESS,
      PipelineStage.QUOTE_SENT,
      PipelineStage.NEGOTIATION,
      PipelineStage.CLOSED_WON,
      PipelineStage.CLOSED_LOST,
    ]);
  });
});

describe("leadIsVisible", () => {
  it("SALESPERSON can see own lead at any stage", () => {
    for (const s of Object.values(PipelineStage)) {
      expect(leadIsVisible(Role.SALESPERSON, ME, ME, s)).toBe(true);
    }
  });

  it("SALESPERSON cannot see someone else's lead", () => {
    expect(leadIsVisible(Role.SALESPERSON, ME, SOMEONE_ELSE, PipelineStage.LEAD)).toBe(false);
  });

  it("VCIO can see Site Survey Scheduled+ leads regardless of owner", () => {
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.SITE_SURVEY_SCHEDULED)).toBe(true);
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.NEGOTIATION)).toBe(true);
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.CLOSED_WON)).toBe(true);
  });

  it("VCIO blocked from early-stage leads", () => {
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.LEAD)).toBe(false);
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.QUALIFIED)).toBe(false);
    expect(leadIsVisible(Role.VCIO, ME, SOMEONE_ELSE, PipelineStage.FIRST_INTERACTION)).toBe(false);
  });

  it("COO can see all leads at any stage (RO is API-level)", () => {
    expect(leadIsVisible(Role.COO, ME, SOMEONE_ELSE, PipelineStage.LEAD)).toBe(true);
    expect(leadIsVisible(Role.COO, ME, SOMEONE_ELSE, PipelineStage.CLOSED_WON)).toBe(true);
  });

  it("SUPERADMIN can see everything", () => {
    expect(leadIsVisible(Role.SUPERADMIN, ME, SOMEONE_ELSE, PipelineStage.LEAD)).toBe(true);
  });
});
