import { describe, expect, it } from "vitest";
import { PipelineStage } from "@prisma/client";
import { GATES } from "@/lib/pipeline/gates";

describe("pipeline gates — registry", () => {
  it("defines exactly 4 default gates", () => {
    expect(GATES.length).toBe(4);
  });

  it("covers the canonical advancement edges", () => {
    const edges = GATES.map((g) => `${g.from}->${g.to}`);
    expect(edges).toContain(`${PipelineStage.LEAD}->${PipelineStage.QUALIFIED}`);
    expect(edges).toContain(`${PipelineStage.DISCOVERY}->${PipelineStage.PRE_SALES}`);
    expect(edges).toContain(`${PipelineStage.PROPOSAL}->${PipelineStage.NEGOTIATION}`);
    expect(edges).toContain(`${PipelineStage.NEGOTIATION}->${PipelineStage.CLOSED_WON}`);
  });

  it("every gate carries a human-readable label", () => {
    for (const g of GATES) {
      expect(g.label.length).toBeGreaterThan(3);
    }
  });

  it("no gate fires on backward / lateral transitions", () => {
    // A salesperson moving from QUALIFIED back to LEAD should not be gated.
    const backward = GATES.find((g) => g.from === PipelineStage.QUALIFIED && g.to === PipelineStage.LEAD);
    expect(backward).toBeUndefined();
    // Lateral to NURTURE / CLOSED_LOST should also be ungated.
    const toNurture = GATES.find((g) => g.to === PipelineStage.NURTURE);
    expect(toNurture).toBeUndefined();
    const toLost = GATES.find((g) => g.to === PipelineStage.CLOSED_LOST);
    expect(toLost).toBeUndefined();
  });
});
