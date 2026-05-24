/**
 * v2.20 — Per-lead + org-wide Claude budget enforcement.
 *
 * Caps default to 20 calls / $5 per lead per month, and $200 org-wide per
 * month. Both are tunable via SystemConfig key `ai.budget` so a Superadmin
 * can raise/lower without a deploy.
 *
 * Usage pattern: every new AI feature route calls `checkBudget()` BEFORE
 * invoking Claude. After the call returns, `recordUsage()` writes the
 * AiUsageLog row. The Phase-C streaming research summarizer also flows
 * through this same gate.
 */

import { AiFeatureKind, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { estimateCallCostUsd } from "./pricing";

// ---------------------------------------------------------------------------
// Tunable caps (SystemConfig override + defaults)
// ---------------------------------------------------------------------------

export type AiBudgetConfig = {
  perLeadMonthlyCallCap: number;
  perLeadMonthlyCostUsd: number;
  orgMonthlyCostUsd: number;
};

export const DEFAULT_AI_BUDGET: AiBudgetConfig = {
  perLeadMonthlyCallCap: 20,
  perLeadMonthlyCostUsd: 5,
  orgMonthlyCostUsd: 200,
};

const SYSTEM_CONFIG_KEY = "ai.budget";

/**
 * Read tunable caps from SystemConfig (merged onto defaults). Cached for
 * the duration of the request via a module-level promise — keeps the budget
 * check cheap when many calls fire close together.
 */
let cached: { config: AiBudgetConfig; expiresAt: number } | null = null;
const CACHE_MS = 30 * 1000;

export async function loadBudget(): Promise<AiBudgetConfig> {
  if (cached && cached.expiresAt > Date.now()) return cached.config;
  const row = await prisma.systemConfig.findUnique({ where: { key: SYSTEM_CONFIG_KEY } });
  const value = (row?.value ?? {}) as Partial<AiBudgetConfig>;
  const merged: AiBudgetConfig = {
    perLeadMonthlyCallCap: value.perLeadMonthlyCallCap ?? DEFAULT_AI_BUDGET.perLeadMonthlyCallCap,
    perLeadMonthlyCostUsd: value.perLeadMonthlyCostUsd ?? DEFAULT_AI_BUDGET.perLeadMonthlyCostUsd,
    orgMonthlyCostUsd: value.orgMonthlyCostUsd ?? DEFAULT_AI_BUDGET.orgMonthlyCostUsd,
  };
  cached = { config: merged, expiresAt: Date.now() + CACHE_MS };
  return merged;
}

export function invalidateBudgetCache(): void {
  cached = null;
}

// ---------------------------------------------------------------------------
// Spend roll-ups
// ---------------------------------------------------------------------------

export type SpendSnapshot = {
  callsThisMonth: number;
  costUsdThisMonth: number;
};

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function spendForLead(leadId: string): Promise<SpendSnapshot> {
  const since = startOfMonth();
  const rows = await prisma.aiUsageLog.findMany({
    where: { leadId, createdAt: { gte: since } },
    select: { estimatedCostUsd: true },
  });
  return {
    callsThisMonth: rows.length,
    costUsdThisMonth: rows.reduce((sum, r) => sum + Number(r.estimatedCostUsd), 0),
  };
}

export async function spendForOrg(): Promise<SpendSnapshot> {
  const since = startOfMonth();
  const rows = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: { estimatedCostUsd: true },
  });
  return {
    callsThisMonth: rows.length,
    costUsdThisMonth: rows.reduce((sum, r) => sum + Number(r.estimatedCostUsd), 0),
  };
}

// ---------------------------------------------------------------------------
// Pre-call check
// ---------------------------------------------------------------------------

export class AiBudgetExceededError extends Error {
  status = 429;
  constructor(
    public scope: "per-lead" | "org",
    public reason: "calls" | "cost",
    public detail: string,
  ) {
    super(`AI budget exceeded (${scope}/${reason}): ${detail}`);
    this.name = "AiBudgetExceededError";
  }
}

/**
 * Verify the caller is allowed to spend another Claude call. Throws
 * AiBudgetExceededError on cap breach. Returns a snapshot of remaining
 * budget so the caller can echo it back in the response for UI display.
 */
export async function checkBudget(opts: { leadId?: string }): Promise<{
  config: AiBudgetConfig;
  perLead: SpendSnapshot | null;
  org: SpendSnapshot;
}> {
  const config = await loadBudget();
  const org = await spendForOrg();
  let perLead: SpendSnapshot | null = null;

  // Org-wide cap takes precedence (cheaper to check, prevents runaway).
  if (org.costUsdThisMonth >= config.orgMonthlyCostUsd) {
    throw new AiBudgetExceededError(
      "org",
      "cost",
      `org month-to-date $${org.costUsdThisMonth.toFixed(2)} of $${config.orgMonthlyCostUsd.toFixed(2)}`,
    );
  }

  if (opts.leadId) {
    perLead = await spendForLead(opts.leadId);
    if (perLead.callsThisMonth >= config.perLeadMonthlyCallCap) {
      throw new AiBudgetExceededError(
        "per-lead",
        "calls",
        `${perLead.callsThisMonth}/${config.perLeadMonthlyCallCap} calls used this month — resets 1st of next month`,
      );
    }
    if (perLead.costUsdThisMonth >= config.perLeadMonthlyCostUsd) {
      throw new AiBudgetExceededError(
        "per-lead",
        "cost",
        `$${perLead.costUsdThisMonth.toFixed(2)} / $${config.perLeadMonthlyCostUsd.toFixed(2)} spent this month`,
      );
    }
  }

  return { config, perLead, org };
}

// ---------------------------------------------------------------------------
// Post-call recording
// ---------------------------------------------------------------------------

export async function recordUsage(opts: {
  leadId?: string;
  userId?: string;
  feature: AiFeatureKind;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}): Promise<void> {
  const cost = estimateCallCostUsd(opts);
  await prisma.aiUsageLog.create({
    data: {
      leadId: opts.leadId ?? null,
      userId: opts.userId ?? null,
      feature: opts.feature,
      model: opts.model,
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      cacheReadInputTokens: opts.cacheReadInputTokens ?? null,
      cacheCreationInputTokens: opts.cacheCreationInputTokens ?? null,
      estimatedCostUsd: cost as unknown as Prisma.Decimal,
    },
  });
}
