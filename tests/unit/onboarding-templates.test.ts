import { describe, expect, it } from "vitest";
import { OnboardingPhase } from "@prisma/client";
import { TASK_TEMPLATES, templatesForPhase } from "@/lib/onboarding/task-templates";

describe("onboarding task templates", () => {
  it("every phase has at least one task", () => {
    for (const phase of Object.values(OnboardingPhase)) {
      const tasks = templatesForPhase(phase);
      expect(tasks.length, `${phase} has no tasks`).toBeGreaterThan(0);
    }
  });

  it("template keys are unique", () => {
    const keys = TASK_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template has a non-empty title", () => {
    for (const t of TASK_TEMPLATES) {
      expect(t.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("dueOffsetDays values, when present, are positive integers", () => {
    // Tasks within a phase can run in parallel — strict monotonicity isn't
    // required; just check the offsets are sane values.
    for (const t of TASK_TEMPLATES) {
      if (t.dueOffsetDays !== undefined) {
        expect(t.dueOffsetDays).toBeGreaterThan(0);
        expect(Number.isInteger(t.dueOffsetDays)).toBe(true);
      }
    }
  });
});
