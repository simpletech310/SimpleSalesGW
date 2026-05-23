import { describe, expect, it } from "vitest";
import { ServiceBundle } from "@prisma/client";
import {
  budgetSnapshotSchema,
  commitmentSchema,
  decisionMakerSchema,
  handoffInitiateSchema,
  objectionSkepticSchema,
  successCriterionSchema,
} from "@/lib/handoff/schema";

const validLeadId = "11111111-1111-1111-1111-111111111111";

describe("handoff zod schemas — sub-schemas", () => {
  it("decisionMakerSchema requires a non-empty name", () => {
    expect(decisionMakerSchema.safeParse({ name: "" }).success).toBe(false);
    expect(decisionMakerSchema.safeParse({ name: "Alice" }).success).toBe(true);
  });

  it("decisionMakerSchema accepts authority + temperature enums", () => {
    const ok = decisionMakerSchema.safeParse({ name: "Bob", authority: "FINAL", temperature: "CHAMPION" });
    expect(ok.success).toBe(true);
    const bad = decisionMakerSchema.safeParse({ name: "Bob", authority: "MAYBE" });
    expect(bad.success).toBe(false);
  });

  it("commitmentSchema requires text", () => {
    expect(commitmentSchema.safeParse({ text: "" }).success).toBe(false);
    expect(commitmentSchema.safeParse({ text: "Deliver SOW §3.2 by EOD Friday", sowRef: "SOW §3.2" }).success).toBe(true);
  });

  it("objectionSkepticSchema requires concern", () => {
    expect(objectionSkepticSchema.safeParse({ concern: "" }).success).toBe(false);
    const ok = objectionSkepticSchema.safeParse({ name: "VP Ops", concern: "Worried about migration risk", status: "WATCH" });
    expect(ok.success).toBe(true);
  });

  it("budgetSnapshotSchema status enum is enforced", () => {
    expect(budgetSnapshotSchema.safeParse({ status: "APPROVED", range: "$8-12k MRR" }).success).toBe(true);
    expect(budgetSnapshotSchema.safeParse({ status: "MAYBE" }).success).toBe(false);
  });

  it("successCriterionSchema requires metric", () => {
    expect(successCriterionSchema.safeParse({ metric: "" }).success).toBe(false);
    expect(successCriterionSchema.safeParse({ metric: "MTTR < 30 min", target: "30m", owner: "Marcelo" }).success).toBe(true);
  });
});

describe("handoff zod schemas — top level", () => {
  it("requires leadId UUID", () => {
    expect(handoffInitiateSchema.safeParse({ leadId: "not-a-uuid" }).success).toBe(false);
    expect(handoffInitiateSchema.safeParse({ leadId: validLeadId }).success).toBe(true);
  });

  it("accepts a complete 60-field payload", () => {
    const payload = {
      leadId: validLeadId,
      dealValue: 24500,
      bundleId: ServiceBundle.COMPLIANCE_PLUS,
      complianceOverlay: ["HIPAA", "PCI"],
      contractsSigned: ["MSA", "SOW"],
      decisionMakers: [
        { name: "Alice", role: "CEO", authority: "FINAL", temperature: "CHAMPION", comms: "Email weekly" },
        { name: "Bob", role: "CFO", authority: "ECONOMIC", temperature: "SUPPORTIVE" },
      ],
      stakeholderContext: "Founder-led. CFO is the gatekeeper.",
      hardCommitments: [
        { text: "Deploy RMM to all endpoints by day 30", sowRef: "SOW §3.1", deadline: "Day 30" },
      ],
      softCommitments: [{ text: "Explore VoIP migration in Q2" }],
      objectionsAndSkeptics: [
        { name: "VP Eng", concern: "Worried about migration risk", status: "WATCH" },
      ],
      budgetSnapshot: { status: "APPROVED", range: "$10-14k MRR", notes: "Board signoff in March" },
      successCriteria: [
        { metric: "MTTR < 30 min", target: "30m", owner: "Marcelo" },
        { metric: "MFA coverage 100%", target: "100%", owner: "vCIO" },
      ],
      notes: "Watch for compliance pushback from VP Eng.",
    };
    const result = handoffInitiateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects more than 5 decision makers", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `Person ${i}` }));
    expect(handoffInitiateSchema.safeParse({ leadId: validLeadId, decisionMakers: six }).success).toBe(false);
  });

  it("accepts an empty handoff (only leadId provided)", () => {
    // All structured fields are optional — early draft / minimal handoff should validate.
    expect(handoffInitiateSchema.safeParse({ leadId: validLeadId }).success).toBe(true);
  });

  it("coerces dealValue from string number", () => {
    const r = handoffInitiateSchema.safeParse({ leadId: validLeadId, dealValue: "12500" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dealValue).toBe(12500);
  });

  it("rejects negative dealValue", () => {
    expect(handoffInitiateSchema.safeParse({ leadId: validLeadId, dealValue: -100 }).success).toBe(false);
  });
});
