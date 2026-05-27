import { describe, expect, it } from "vitest";
import { OnboardingPhase, PipelineStage } from "@prisma/client";
import { buildTimeline } from "@/lib/timeline/stages";

const REF_DATE = new Date("2026-05-23T12:00:00Z");

describe("timeline — sales-only path", () => {
  it("LEAD stage → first segment current, all others future", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.LEAD,
      leadCreatedAt: REF_DATE,
    });
    const current = segs.filter((s) => s.state === "current");
    expect(current.length).toBe(1);
    expect(current[0]!.key).toBe(`pipeline:${PipelineStage.LEAD}`);
  });

  it("QUOTE_SENT stage → 6 completed (LEAD..QUOTE_IN_PROGRESS), 1 current, rest future", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.QUOTE_SENT,
      leadCreatedAt: REF_DATE,
    });
    const sales = segs.filter((s) => s.side === "sales");
    const completed = sales.filter((s) => s.state === "completed").length;
    const current = sales.filter((s) => s.state === "current").length;
    expect(completed).toBe(6);
    expect(current).toBe(1);
  });

  it("CLOSED_WON marks the sales lane completed and ops side starts as future when no customer", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.CLOSED_WON,
      leadCreatedAt: REF_DATE,
    });
    const sales = segs.filter((s) => s.side === "sales");
    expect(sales.filter((s) => s.state === "current").length).toBe(1);
    expect(sales[sales.length - 1]!.state).toBe("current");
    const ops = segs.filter((s) => s.side === "ops");
    expect(ops.every((s) => s.state === "future")).toBe(true);
  });

  it("CLOSED_LOST renders the sales-won lane as dormant and surfaces its own segment", () => {
    const lost = buildTimeline({ pipelineStage: PipelineStage.CLOSED_LOST, leadCreatedAt: REF_DATE });
    expect(lost.some((s) => s.key === `pipeline:${PipelineStage.CLOSED_LOST}`)).toBe(true);
    expect(lost.filter((s) => s.side === "sales" && s.state === "dormant").length).toBeGreaterThan(0);
  });
});

describe("timeline — sales + ops join", () => {
  it("CLOSED_WON + onboarding ONBOARD → ops lane has 2 completed + 1 current", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.CLOSED_WON,
      leadCreatedAt: REF_DATE,
      onboarding: { phase: OnboardingPhase.ONBOARD, startedAt: REF_DATE, completedAt: null },
    });
    const ops = segs.filter((s) => s.side === "ops");
    expect(ops.filter((s) => s.state === "completed").length).toBe(2); // PRE_ENGAGEMENT, DISCOVERY
    expect(ops.filter((s) => s.state === "current").length).toBe(1);   // ONBOARD
    expect(ops.filter((s) => s.state === "future").length).toBe(2);    // STABILIZE, STEADY_STATE
  });

  it("STEADY_STATE with completedAt set marks the final ops segment completed", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.CLOSED_WON,
      leadCreatedAt: REF_DATE,
      onboarding: {
        phase: OnboardingPhase.STEADY_STATE,
        startedAt: REF_DATE,
        completedAt: new Date(REF_DATE.getTime() + 90 * 86_400_000),
      },
    });
    const last = segs[segs.length - 1]!;
    expect(last.key).toBe(`onboarding:${OnboardingPhase.STEADY_STATE}`);
    expect(last.state).toBe("completed");
  });
});

describe("timeline — gate icons", () => {
  it("propagates gate{passed,blocked} into segment metadata", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.LEAD,
      leadCreatedAt: REF_DATE,
      gates: {
        [`pipeline:${PipelineStage.LEAD}`]: { passed: false, note: "Qualification too low" },
        [`pipeline:${PipelineStage.QUOTE_SENT}`]: { passed: true },
      },
    });
    const leadSeg = segs.find((s) => s.key === `pipeline:${PipelineStage.LEAD}`)!;
    expect(leadSeg.gate).toBe("blocked");
    expect(leadSeg.gateNote).toMatch(/Qualification/);
    const propSeg = segs.find((s) => s.key === `pipeline:${PipelineStage.QUOTE_SENT}`)!;
    expect(propSeg.gate).toBe("passed");
  });
});

describe("timeline — invariants", () => {
  it("always returns at least the 5 ops segments + 7 won-path sales segments (12 minimum)", () => {
    const segs = buildTimeline({
      pipelineStage: PipelineStage.LEAD,
      leadCreatedAt: REF_DATE,
    });
    const sales = segs.filter((s) => s.side === "sales").length;
    const ops = segs.filter((s) => s.side === "ops").length;
    expect(sales).toBeGreaterThanOrEqual(7);
    expect(ops).toBe(5);
  });

  it("exactly one current segment on the sales lane (non-terminal)", () => {
    for (const stage of [
      PipelineStage.LEAD, PipelineStage.QUALIFIED, PipelineStage.FIRST_INTERACTION,
      PipelineStage.SITE_SURVEY_SCHEDULED, PipelineStage.DISCOVERY,
      PipelineStage.QUOTE_IN_PROGRESS, PipelineStage.QUOTE_SENT, PipelineStage.NEGOTIATION,
    ]) {
      const segs = buildTimeline({ pipelineStage: stage, leadCreatedAt: REF_DATE });
      const cur = segs.filter((s) => s.side === "sales" && s.state === "current");
      expect(cur.length).toBe(1);
    }
  });
});
