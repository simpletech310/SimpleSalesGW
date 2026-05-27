import { describe, expect, it } from "vitest";
import { PipelineStage } from "@prisma/client";
import { GATES } from "@/lib/pipeline/gates";

describe("pipeline gates — registry", () => {
  it("covers the canonical advancement edges", () => {
    const edges = GATES.map((g) => `${g.from}->${g.to}`);
    expect(edges).toContain(`${PipelineStage.LEAD}->${PipelineStage.QUALIFIED}`);
    expect(edges).toContain(`${PipelineStage.QUALIFIED}->${PipelineStage.FIRST_INTERACTION}`);
    expect(edges).toContain(`${PipelineStage.FIRST_INTERACTION}->${PipelineStage.SITE_SURVEY_SCHEDULED}`);
    expect(edges).toContain(`${PipelineStage.SITE_SURVEY_SCHEDULED}->${PipelineStage.DISCOVERY}`);
    expect(edges).toContain(`${PipelineStage.DISCOVERY}->${PipelineStage.QUOTE_IN_PROGRESS}`);
    expect(edges).toContain(`${PipelineStage.QUOTE_IN_PROGRESS}->${PipelineStage.QUOTE_SENT}`);
    expect(edges).toContain(`${PipelineStage.QUOTE_SENT}->${PipelineStage.NEGOTIATION}`);
    expect(edges).toContain(`${PipelineStage.NEGOTIATION}->${PipelineStage.CLOSED_WON}`);
  });

  it("every gate carries a human-readable label and a kind", () => {
    for (const g of GATES) {
      expect(g.label.length).toBeGreaterThan(3);
      expect(["hard", "warning"]).toContain(g.kind);
    }
  });

  it("CLOSED_LOST has hard gates from every active stage requiring a loss reason", () => {
    const fromActive = [
      PipelineStage.LEAD,
      PipelineStage.QUALIFIED,
      PipelineStage.FIRST_INTERACTION,
      PipelineStage.SITE_SURVEY_SCHEDULED,
      PipelineStage.DISCOVERY,
      PipelineStage.QUOTE_IN_PROGRESS,
      PipelineStage.QUOTE_SENT,
      PipelineStage.NEGOTIATION,
    ];
    for (const from of fromActive) {
      const gate = GATES.find((g) => g.from === from && g.to === PipelineStage.CLOSED_LOST);
      expect(gate, `${from} → CLOSED_LOST should have a gate`).toBeDefined();
      expect(gate?.kind).toBe("hard");
    }
  });

  it("no gate fires on backward / lateral transitions", () => {
    const backward = GATES.find((g) => g.from === PipelineStage.QUALIFIED && g.to === PipelineStage.LEAD);
    expect(backward).toBeUndefined();
  });
});
