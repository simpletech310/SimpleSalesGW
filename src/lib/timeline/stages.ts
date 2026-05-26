/**
 * 14-stage unified process timeline.
 *
 * Joins the 9 PipelineStage values (sales side) with the 5 OnboardingPhase
 * values (post-close side). The handoff acceptance is the bridge: once a
 * Lead's pipelineStage is CLOSED_WON and a Handoff is ACCEPTED, the engagement
 * transitions onto the OnboardingPhase track which lives on the Customer row.
 *
 * Stages that don't apply to a given lifecycle (e.g. CLOSED_LOST / NURTURE on
 * the won-deal path) are returned as `dormant` so the renderer can mute them.
 */

import { OnboardingPhase, PipelineStage } from "@prisma/client";

export type StageKey =
  | `pipeline:${PipelineStage}`
  | `onboarding:${OnboardingPhase}`;

export type TimelineSegment = {
  key: StageKey;
  label: string;
  short: string;
  side: "sales" | "ops";
  state: "completed" | "current" | "future" | "dormant";
  /** When this segment was entered (only for completed/current). */
  enteredAt?: string;
  /** Days the engagement has been in this segment (only for current). */
  daysInStage?: number;
  /** Gate status icon for the next-stage transition. */
  gate?: "passed" | "blocked" | "future";
  /** Human-readable note for the icon. */
  gateNote?: string;
};

// v3.3.22 — MSP-friendly canonical flow. PRE_SALES + PROPOSAL stay in
// the enum but are no longer on the default win path — they're skipped
// here unless a legacy lead actually sits in one (handled below).
const SALES_WON: PipelineStage[] = [
  PipelineStage.LEAD,
  PipelineStage.QUALIFIED,
  PipelineStage.FIRST_INTERACTION,
  PipelineStage.SITE_SURVEY_SCHEDULED,
  PipelineStage.DISCOVERY,
  PipelineStage.QUOTE_IN_PROGRESS,
  PipelineStage.QUOTE_SENT,
  PipelineStage.NEGOTIATION,
  PipelineStage.CLOSED_WON,
];

// Legacy stages — only injected into the timeline when the lead is
// currently in one of them (otherwise we skip).
const LEGACY_STAGES: PipelineStage[] = [PipelineStage.PRE_SALES, PipelineStage.PROPOSAL];

const ONBOARDING_ORDER: OnboardingPhase[] = [
  OnboardingPhase.PRE_ENGAGEMENT,
  OnboardingPhase.DISCOVERY,
  OnboardingPhase.ONBOARD,
  OnboardingPhase.STABILIZE,
  OnboardingPhase.STEADY_STATE,
];

const PIPELINE_LABEL: Record<PipelineStage, { full: string; short: string }> = {
  LEAD:                   { full: "Lead",                  short: "Lead" },
  QUALIFIED:              { full: "Qualified",             short: "Qual" },
  // v3.3.22 — new MSP-friendly stages
  FIRST_INTERACTION:      { full: "1st interaction",       short: "1st" },
  SITE_SURVEY_SCHEDULED:  { full: "Site survey scheduled", short: "Site" },
  DISCOVERY:              { full: "Discovery / Engineering", short: "Disco" },
  QUOTE_IN_PROGRESS:      { full: "Quote in progress",     short: "Quote" },
  QUOTE_SENT:             { full: "Quote sent",            short: "Sent" },
  // legacy values — UI still labels them but new leads skip
  PRE_SALES:              { full: "Pre-sales (legacy)",    short: "Pre" },
  PROPOSAL:               { full: "Proposal (legacy)",     short: "Prop" },
  NEGOTIATION:            { full: "Negotiation",           short: "Neg" },
  CLOSED_WON:             { full: "Closed Won",            short: "Won" },
  CLOSED_LOST:            { full: "Closed Lost",           short: "Lost" },
  NURTURE:                { full: "Nurture",               short: "Nurt" },
};

const PHASE_LABEL: Record<OnboardingPhase, { full: string; short: string }> = {
  PRE_ENGAGEMENT: { full: "Pre-engagement", short: "Pre-E" },
  DISCOVERY:      { full: "Discovery",      short: "Disco" },
  ONBOARD:        { full: "Onboard",        short: "OB" },
  STABILIZE:      { full: "Stabilize",      short: "Stab" },
  STEADY_STATE:   { full: "Steady state",   short: "Steady" },
};

export type TimelineInput = {
  pipelineStage: PipelineStage;
  /** When the Lead was created — anchor for time-in-stage on early stages. */
  leadCreatedAt: Date;
  /** When the Lead actually closed (won or lost). */
  actualCloseDate?: Date | null;
  /** Most-recent stage-change timestamp, if tracked. Optional. */
  stageEnteredAt?: Date | null;
  /** Onboarding side — only present after handoff accepted. */
  onboarding?: {
    phase: OnboardingPhase;
    startedAt?: Date | null;
    completedAt?: Date | null;
  } | null;
  /** Optional pre-computed gate flags (passed if requirements met). */
  gates?: Partial<Record<StageKey, { passed: boolean; note?: string }>>;
};

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function buildTimeline(input: TimelineInput): TimelineSegment[] {
  const now = new Date();
  const segments: TimelineSegment[] = [];

  // --- Sales side ---
  const currentIdx = SALES_WON.indexOf(input.pipelineStage);
  const isLost = input.pipelineStage === PipelineStage.CLOSED_LOST;
  const isNurture = input.pipelineStage === PipelineStage.NURTURE;

  SALES_WON.forEach((stage, idx) => {
    const key: StageKey = `pipeline:${stage}`;
    let state: TimelineSegment["state"];
    if (isLost || isNurture) {
      // Off-path leads: only show LEAD through current stage as completed.
      state = "dormant";
    } else if (currentIdx === -1) {
      // Unknown stage — treat all as future.
      state = "future";
    } else if (idx < currentIdx) {
      state = "completed";
    } else if (idx === currentIdx) {
      state = "current";
    } else {
      state = "future";
    }

    const seg: TimelineSegment = {
      key,
      label: PIPELINE_LABEL[stage].full,
      short: PIPELINE_LABEL[stage].short,
      side: "sales",
      state,
    };

    if (state === "current") {
      seg.enteredAt = (input.stageEnteredAt ?? input.leadCreatedAt).toISOString();
      seg.daysInStage = daysBetween(input.stageEnteredAt ?? input.leadCreatedAt, now);
    }
    if (state === "completed" && stage === PipelineStage.CLOSED_WON && input.actualCloseDate) {
      seg.enteredAt = input.actualCloseDate.toISOString();
    }
    const gate = input.gates?.[key];
    if (gate) {
      seg.gate = gate.passed ? "passed" : "blocked";
      seg.gateNote = gate.note;
    }

    segments.push(seg);
  });

  // v3.3.22 — When a legacy lead sits in PRE_SALES or PROPOSAL, inject
  // that stage as the current one so the timeline still tells the truth.
  const isLegacy = LEGACY_STAGES.includes(input.pipelineStage);
  if (isLegacy) {
    segments.push({
      key: `pipeline:${input.pipelineStage}`,
      label: PIPELINE_LABEL[input.pipelineStage].full,
      short: PIPELINE_LABEL[input.pipelineStage].short,
      side: "sales",
      state: "current",
      enteredAt: (input.stageEnteredAt ?? input.leadCreatedAt).toISOString(),
      daysInStage: daysBetween(input.stageEnteredAt ?? input.leadCreatedAt, now),
    });
  }

  // Inject terminal stages as dormant siblings so renderers can show them when relevant.
  if (isLost) {
    segments.push({
      key: `pipeline:${PipelineStage.CLOSED_LOST}`,
      label: PIPELINE_LABEL.CLOSED_LOST.full,
      short: PIPELINE_LABEL.CLOSED_LOST.short,
      side: "sales",
      state: "current",
      enteredAt: (input.actualCloseDate ?? input.stageEnteredAt ?? input.leadCreatedAt).toISOString(),
    });
  } else if (isNurture) {
    segments.push({
      key: `pipeline:${PipelineStage.NURTURE}`,
      label: PIPELINE_LABEL.NURTURE.full,
      short: PIPELINE_LABEL.NURTURE.short,
      side: "sales",
      state: "current",
      enteredAt: (input.stageEnteredAt ?? input.leadCreatedAt).toISOString(),
    });
  }

  // --- Ops side ---
  const ob = input.onboarding ?? null;
  const obIdx = ob ? ONBOARDING_ORDER.indexOf(ob.phase) : -1;

  ONBOARDING_ORDER.forEach((phase, idx) => {
    const key: StageKey = `onboarding:${phase}`;
    let state: TimelineSegment["state"];
    if (!ob) {
      // No customer yet — entire ops side is future.
      state = "future";
    } else if (idx < obIdx) {
      state = "completed";
    } else if (idx === obIdx) {
      state = ob.completedAt ? "completed" : "current";
    } else {
      state = "future";
    }

    const seg: TimelineSegment = {
      key,
      label: PHASE_LABEL[phase].full,
      short: PHASE_LABEL[phase].short,
      side: "ops",
      state,
    };

    if (state === "current" && ob?.startedAt) {
      seg.enteredAt = ob.startedAt.toISOString();
      seg.daysInStage = daysBetween(ob.startedAt, now);
    }
    const gate = input.gates?.[key];
    if (gate) {
      seg.gate = gate.passed ? "passed" : "blocked";
      seg.gateNote = gate.note;
    }

    segments.push(seg);
  });

  return segments;
}
