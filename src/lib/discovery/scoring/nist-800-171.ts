/**
 * NIST 800-171 / CMMC scoring.
 *
 * SPRS scoring per the official NIST 800-171A handbook:
 *   - Start at 110 (perfect).
 *   - For each control not fully Implemented, subtract its deduction value.
 *   - Partial implementation = subtract HALF the deduction (rounded).
 *   - Planned (POAM) = full deduction (still counts against you for SPRS).
 *   - Not applicable = exclude from scoring AND from the 110 baseline.
 *   - Not implemented = full deduction.
 *
 * Output also includes:
 *   - Per-family implementation percentage
 *   - POAM (Plan of Action & Milestones) — controls not Implemented
 *   - SSP draft — templated narrative per family from evidence + statuses
 */

import { NIST_800_171_QUESTIONS, SP800_171_DEDUCTIONS, SP800_171_FAMILIES } from "../nist-800-171-questions";

export type ControlStatus = "implemented" | "partially" | "planned" | "na" | "not_implemented";

export type NistSp800171Scorecard = {
  kind: "NIST_800_171";
  sprsScore: number;
  sprsBaseline: number;        // 110 minus NA controls
  targetLevel: "level_1" | "level_2" | "level_3" | null;
  families: Array<{
    code: string;
    name: string;
    implemented: number;
    partially: number;
    planned: number;
    notImplemented: number;
    notApplicable: number;
    total: number;
    implementationPct: number;
  }>;
  poam: Array<{
    controlId: string;
    statement: string;
    status: Exclude<ControlStatus, "implemented" | "na">;
    deduction: number;
    milestone?: string;
  }>;
  ssp: Array<{
    familyCode: string;
    familyName: string;
    narrative: string;
  }>;
};

function statusOf(answerValue: unknown): ControlStatus | null {
  if (typeof answerValue !== "string") return null;
  if (
    answerValue === "implemented" ||
    answerValue === "partially" ||
    answerValue === "planned" ||
    answerValue === "na" ||
    answerValue === "not_implemented"
  ) return answerValue;
  return null;
}

function deduction(controlId: string): number {
  return SP800_171_DEDUCTIONS[controlId] ?? 1;
}

function familyCode(family: string): string {
  return family.split(" ")[0] ?? family;
}

export function scoreNist800171(answers: Record<string, unknown>): NistSp800171Scorecard {
  const controls = NIST_800_171_QUESTIONS.filter((q) => q.type === "single_select" && q.id !== "TARGET_LEVEL");

  // SPRS calc
  let sprs = 110;
  let baseline = 110;
  const poam: NistSp800171Scorecard["poam"] = [];

  for (const q of controls) {
    const status = statusOf(answers[q.id]);
    if (!status) continue; // unanswered
    const d = deduction(q.id);
    if (status === "implemented") {
      // no deduction
    } else if (status === "na") {
      baseline -= d;
      sprs -= d;
    } else if (status === "partially") {
      const half = Math.ceil(d / 2);
      sprs -= half;
      poam.push({ controlId: q.id, statement: q.prompt, status, deduction: half });
    } else if (status === "planned" || status === "not_implemented") {
      sprs -= d;
      poam.push({ controlId: q.id, statement: q.prompt, status, deduction: d });
    }
  }

  // Per-family tallies
  const families: NistSp800171Scorecard["families"] = SP800_171_FAMILIES.map((fname) => {
    const code = familyCode(fname);
    const fnControls = controls.filter((q) => q.section === fname);
    let implemented = 0, partially = 0, planned = 0, notImplemented = 0, notApplicable = 0;
    for (const q of fnControls) {
      const s = statusOf(answers[q.id]);
      if (s === "implemented") implemented++;
      else if (s === "partially") partially++;
      else if (s === "planned") planned++;
      else if (s === "not_implemented") notImplemented++;
      else if (s === "na") notApplicable++;
    }
    const total = fnControls.length;
    const denom = total - notApplicable;
    const implementationPct = denom === 0 ? 100 : Math.round(((implemented + partially * 0.5) / denom) * 100);
    return {
      code,
      name: fname,
      implemented,
      partially,
      planned,
      notImplemented,
      notApplicable,
      total,
      implementationPct,
    };
  });

  // SSP draft — one paragraph per family
  const ssp = SP800_171_FAMILIES.map((fname) => {
    const code = familyCode(fname);
    const fam = families.find((f) => f.code === code)!;
    const evidence = typeof answers[`NOTES.${code}`] === "string" ? (answers[`NOTES.${code}`] as string) : "";
    const narrative = buildFamilyNarrative(fam, evidence);
    return { familyCode: code, familyName: fname, narrative };
  });

  const tl = typeof answers["TARGET_LEVEL"] === "string" ? answers["TARGET_LEVEL"] : null;
  const targetLevel = (tl === "level_1" || tl === "level_2" || tl === "level_3") ? tl : null;

  return {
    kind: "NIST_800_171",
    sprsScore: sprs,
    sprsBaseline: baseline,
    targetLevel,
    families,
    poam,
    ssp,
  };
}

function buildFamilyNarrative(
  fam: NistSp800171Scorecard["families"][number],
  evidence: string,
): string {
  const lines: string[] = [];
  lines.push(`${fam.name} — ${fam.implementationPct}% implementation across ${fam.total - fam.notApplicable} applicable controls.`);
  lines.push(
    `Status: ${fam.implemented} Implemented, ${fam.partially} Partial, ${fam.planned} Planned, ${fam.notImplemented} Not Implemented` +
    (fam.notApplicable > 0 ? `, ${fam.notApplicable} N/A` : "") + ".",
  );
  if (evidence && evidence.trim()) {
    lines.push("");
    lines.push("Evidence:");
    lines.push(evidence.trim());
  }
  return lines.join("\n");
}
