/**
 * v2.23 — vCIO post-assessment recommendation engine.
 *
 * After a DiscoveryAssessment hits COMPLETED, the vCIO clicks
 * "Generate plan" and Claude reads the scorecard + answers + MSP
 * profile and returns a structured plan: recommended onboarding tasks
 * (per phase, role-tagged), recommended service lines, risks, and a
 * customer-facing CTA. The vCIO can review + accept → tasks materialize
 * onto Customer.onboardingTasks.
 *
 * Mirrors the v2.20e presale-narrative pattern (JSON output, budget-gated,
 * MSP profile block prepended).
 */

import { AiFeatureKind, OnboardingPhase, Role, ServiceLine } from "@prisma/client";
import { claudeCompletion } from "@/lib/ai/anthropic";
import { loadProfile } from "@/lib/msp/loader";
import { renderMspProfileBlock } from "@/lib/msp/promptBlock";

const TASK_INSTRUCTIONS = `## Your job
You are a vCIO / Sales Engineer recommendation assistant for the
company described above.

A teammate has just completed a discovery assessment for a customer.
You have:
  - The MSP profile (services emphasis, win stories, voice, out-of-scope)
  - The customer's basic context (industry, seats, compliance posture)
  - The assessment scorecard (findings, risks, recommended actions,
    recommended line items, coverage %)
  - The raw assessment answers

Your job: produce a structured plan the vCIO can present to the customer.
The plan must:
  - Translate findings + risks into concrete onboarding TASKS the vCIO
    can hand to operations once the customer accepts.
  - Lean toward [focus] services from the company profile when they fit;
    DO NOT recommend [de-emphasize] services or anything in Out-of-scope.
  - Follow the Full-stack consideration rule from the company profile.
    Walk the whole catalog before settling on recommendations. A site
    survey that surfaces old phones, no badge readers, no cameras, or
    AI-strategy questions deserves recommendedServices entries for
    VOIP / ACCESS_CONTROL / VIDEO / AI_ADVISORY — not just managed IT
    and cybersecurity. Default cyber/NIST framing is wrong unless the
    answers clearly point to security gaps, insurance pressure, or a
    named compliance driver.
  - recommendedServices should typically span 3-5 lines reflecting the
    full opportunity, not just 1-2 security items.
  - Tag each task with the right OnboardingPhase + owner Role.
  - Phase mapping rule of thumb:
      PRE_ENGAGEMENT — contract, scope-lock, billing setup
      DISCOVERY      — survey gaps, asset capture, baseline assessments
      ONBOARD        — actual implementation work, migrations, deployments
      STABILIZE      — first 30-60 days post-launch (monitoring, tuning)
      STEADY_STATE   — recurring cadence (QBRs, renewals, drills)
  - dueOffsetDays is a positive integer of days from kickoff; group
    related items close together.

Tone: warm + direct, follow the company Voice line above. The
customerNextStep is in the CUSTOMER's words, not internal jargon.

Output strictly as a single JSON object:
{
  "summary": "one paragraph, 4-6 sentences, customer-facing — what we found and what we recommend",
  "recommendedTasks": [
    {
      "phase": "PRE_ENGAGEMENT | DISCOVERY | ONBOARD | STABILIZE | STEADY_STATE",
      "title": "short imperative — 'Deploy MDR agents on all endpoints'",
      "description": "1-2 sentences of context for the assignee",
      "ownerRole": "VCIO | COO | SALESPERSON",
      "dueOffsetDays": 14,
      "priority": "high | medium | low",
      "sourceFinding": "the finding or risk this addresses, verbatim from the scorecard if possible"
    },
    ...
  ],
  "recommendedServices": [
    { "serviceLine": "MANAGED_IT | CYBERSECURITY | NIST_ASSESSMENT | AI_ADVISORY | VCIO_RETAINER | VOIP | CABLING | ACCESS_CONTROL | VIDEO", "why": "one line grounded in the findings" }
  ],
  "risks": [
    { "severity": "high | medium | low", "description": "what's at stake if unaddressed" }
  ],
  "customerNextStep": "one sentence the customer reads — 'Sign the attached SOW so we can kick off next Monday', etc."
}

Aim for 8-15 tasks total spread across phases. If the assessment is
thin (few findings, low coverage), produce a smaller plan and call out
in summary that a deeper discovery is the right next step.`;

export type VcioRecommendedTask = {
  phase: OnboardingPhase;
  title: string;
  description: string;
  ownerRole: Role;
  dueOffsetDays: number;
  priority: "high" | "medium" | "low";
  sourceFinding?: string;
};

export type VcioRecommendedService = {
  serviceLine: ServiceLine;
  why: string;
};

export type VcioRecommendation = {
  summary: string;
  recommendedTasks: VcioRecommendedTask[];
  recommendedServices: VcioRecommendedService[];
  risks: Array<{ severity: "high" | "medium" | "low"; description: string }>;
  customerNextStep: string;
  raw: string;
};

export type VcioRecommendationInput = {
  context: {
    businessName: string;
    industry: string;
    seatCount: number | null;
    addressCity: string | null;
    addressState: string | null;
    complianceDrivers: string[];
    currentMspName: string | null;
  };
  assessment: {
    kind: string;
    scorecard: Record<string, unknown> | null;
    answers: Record<string, unknown>;
    coveragePct?: number;
  };
};

const PHASES_ORDER: OnboardingPhase[] = [
  OnboardingPhase.PRE_ENGAGEMENT,
  OnboardingPhase.DISCOVERY,
  OnboardingPhase.ONBOARD,
  OnboardingPhase.STABILIZE,
  OnboardingPhase.STEADY_STATE,
];

const OWNER_ROLES = new Set<Role>([Role.VCIO, Role.COO, Role.SALESPERSON]);

export async function generateVcioPlan(
  input: VcioRecommendationInput,
  budget: { leadId?: string; userId?: string },
): Promise<VcioRecommendation> {
  const ctx = input.context;
  const ctxBlock = [
    `Business: ${ctx.businessName}`,
    `Industry: ${ctx.industry}`,
    ctx.seatCount ? `Seats: ${ctx.seatCount}` : null,
    ctx.addressCity || ctx.addressState
      ? `Location: ${[ctx.addressCity, ctx.addressState].filter(Boolean).join(", ")}`
      : null,
    ctx.complianceDrivers.length > 0 ? `Compliance drivers: ${ctx.complianceDrivers.join(", ")}` : null,
    ctx.currentMspName ? `Current MSP: ${ctx.currentMspName}` : null,
  ].filter(Boolean).join("\n");

  // Prefer the structured sections digest from the scorecard (v3.3.2 —
  // SiteSurvey now emits per-section answered lines, gaps, findings, and
  // risks). Falls back to raw answers when sections aren't present (older
  // assessment kinds, or pre-v3.3.2 stored scorecards).
  const sc = (input.assessment.scorecard ?? null) as
    | (Record<string, unknown> & {
        summary?: string;
        findings?: string[];
        risks?: Array<{ severity?: string; description?: string }>;
        recommendedActions?: string[];
        coveragePct?: number;
        sections?: Array<{ section: string; answeredCount?: number; totalCount?: number; coveragePct?: number; answers?: string[] }>;
        gaps?: Array<{ section: string; missing: number }>;
      })
    | null;

  const sectionsBlock = Array.isArray(sc?.sections) && sc!.sections!.length > 0
    ? sc!.sections!
        .map((s) => {
          const header = `### ${s.section} (${s.answeredCount ?? 0}/${s.totalCount ?? 0} answered, ${s.coveragePct ?? 0}%)`;
          const body = Array.isArray(s.answers) && s.answers.length > 0
            ? s.answers.map((a) => `- ${a}`).join("\n")
            : "(no answers)";
          return `${header}\n${body}`;
        })
        .join("\n\n")
        .slice(0, 7000)
    : null;

  const scorecardSummaryBlock = sc
    ? [
        sc.summary ? `Summary: ${sc.summary}` : null,
        typeof sc.coveragePct === "number" ? `Coverage: ${sc.coveragePct}%` : null,
        Array.isArray(sc.findings) && sc.findings.length > 0 ? `Findings:\n- ${sc.findings.join("\n- ")}` : null,
        Array.isArray(sc.risks) && sc.risks.length > 0
          ? `Risks:\n${sc.risks.map((r) => `- [${r.severity ?? "?"}] ${r.description ?? ""}`).join("\n")}`
          : null,
        Array.isArray(sc.recommendedActions) && sc.recommendedActions.length > 0
          ? `Recommended actions (from scorer):\n- ${sc.recommendedActions.join("\n- ")}`
          : null,
        Array.isArray(sc.gaps) && sc.gaps.length > 0
          ? `Gaps (unanswered required questions):\n${sc.gaps.map((g) => `- ${g.section}: ${g.missing}`).join("\n")}`
          : null,
      ].filter(Boolean).join("\n\n")
    : "(no structured scorecard)";

  // Raw answers fallback — only used when the scorecard didn't supply a
  // sections digest, since otherwise it's duplicate signal eating tokens.
  const rawAnswersBlock = sectionsBlock
    ? null
    : JSON.stringify(input.assessment.answers, null, 2).slice(0, 4000);

  const user = [
    `CUSTOMER CONTEXT\n${ctxBlock}`,
    `ASSESSMENT KIND\n${input.assessment.kind}`,
    `SCORECARD SUMMARY\n${scorecardSummaryBlock}`,
    sectionsBlock ? `ASSESSMENT ANSWERS (by section)\n${sectionsBlock}` : null,
    rawAnswersBlock ? `RAW ANSWERS (fallback, truncated)\n${rawAnswersBlock}` : null,
  ].filter(Boolean).join("\n\n");

  const responseHint = `Return ONLY the JSON object — no markdown, no commentary.`;

  const profile = await loadProfile();
  const systemPrompt = `${renderMspProfileBlock(profile)}\n\n${TASK_INSTRUCTIONS}`;

  const { text } = await claudeCompletion({
    system: systemPrompt,
    user,
    responseHint,
    maxTokens: 2500,
    budget: budget.leadId
      ? { leadId: budget.leadId, userId: budget.userId, feature: AiFeatureKind.VCIO_RECOMMENDATION }
      : undefined,
  });

  let parsed: Partial<VcioRecommendation> = {};
  try {
    const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<VcioRecommendation>;
  } catch {
    parsed = { summary: text, recommendedTasks: [], recommendedServices: [], risks: [], customerNextStep: "" };
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    recommendedTasks: Array.isArray(parsed.recommendedTasks)
      ? parsed.recommendedTasks.map(normalizeTask).filter((t): t is VcioRecommendedTask => t != null)
      : [],
    recommendedServices: Array.isArray(parsed.recommendedServices)
      ? parsed.recommendedServices.map(normalizeService).filter((s): s is VcioRecommendedService => s != null)
      : [],
    risks: Array.isArray(parsed.risks)
      ? parsed.risks
          .map((r) => {
            const sev = (r as { severity?: string }).severity;
            const desc = (r as { description?: string }).description;
            if (typeof desc !== "string" || !desc.trim()) return null;
            return {
              severity: sev === "high" || sev === "medium" || sev === "low" ? sev : ("low" as const),
              description: desc,
            };
          })
          .filter((r): r is { severity: "high" | "medium" | "low"; description: string } => r != null)
      : [],
    customerNextStep: typeof parsed.customerNextStep === "string" ? parsed.customerNextStep : "",
    raw: text,
  };
}

function normalizeTask(raw: unknown): VcioRecommendedTask | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const phaseStr = String(t.phase ?? "");
  const phase = PHASES_ORDER.find((p) => p === phaseStr);
  if (!phase) return null;
  const title = typeof t.title === "string" ? t.title.trim() : "";
  if (!title) return null;
  const description = typeof t.description === "string" ? t.description : "";
  const ownerRoleStr = String(t.ownerRole ?? "VCIO");
  const ownerRole = (Object.values(Role) as string[]).includes(ownerRoleStr)
    && OWNER_ROLES.has(ownerRoleStr as Role)
    ? (ownerRoleStr as Role)
    : Role.VCIO;
  const dueRaw = Number(t.dueOffsetDays);
  const dueOffsetDays = Number.isFinite(dueRaw) && dueRaw >= 0 ? Math.round(dueRaw) : 14;
  const prio = String(t.priority ?? "medium");
  const priority = prio === "high" || prio === "medium" || prio === "low" ? prio : "medium";
  const sourceFinding = typeof t.sourceFinding === "string" ? t.sourceFinding : undefined;
  return { phase, title, description, ownerRole, dueOffsetDays, priority, sourceFinding };
}

function normalizeService(raw: unknown): VcioRecommendedService | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slStr = String(r.serviceLine ?? "");
  if (!(Object.values(ServiceLine) as string[]).includes(slStr)) return null;
  const why = typeof r.why === "string" ? r.why : "";
  if (!why.trim()) return null;
  return { serviceLine: slStr as ServiceLine, why };
}
