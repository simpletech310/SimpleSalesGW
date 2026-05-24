/**
 * v2.21 — MSP profile → Claude prompt block.
 *
 * Renders an MspProfile as plain-prose markdown that every Claude
 * system prompt prepends. Format is hand-tuned for Claude parsing:
 * short labeled sections, bullet lists, no JSON.
 *
 * Output is stable + deterministic for a given profile so the
 * `cache_control: ephemeral` cache hits work as expected. When the
 * profile changes the entire block changes → next call pays
 * cache-creation rate once, then reads cache for 5 minutes.
 */

import type { MspProfile, ServiceLineProfile } from "./profile";

/**
 * Render the MSP business profile as a markdown prompt block.
 *
 * Empty optional sections are omitted entirely so Claude doesn't see
 * "Differentiators: (none)" — keeps the prompt focused.
 */
export function renderMspProfileBlock(profile: MspProfile): string {
  const lines: string[] = [];

  // Identity
  lines.push(`## Company: ${profile.companyName}`);
  lines.push(`Location: ${profile.location}${profile.tagline ? ` — ${profile.tagline}.` : "."}`);
  lines.push("");

  if (profile.missionStatement.trim()) {
    lines.push(`Mission: ${profile.missionStatement.trim()}`);
    lines.push("");
  }

  if (profile.brandVoice.trim()) {
    lines.push(`Voice: ${profile.brandVoice.trim()}`);
    lines.push("");
  }

  if (profile.background.trim()) {
    lines.push(`Background: ${profile.background.trim()}`);
    lines.push("");
  }

  // Services with emphasis
  if (profile.services.length > 0) {
    lines.push("Services we sell (emphasis-tagged):");
    for (const s of profile.services) {
      lines.push(`  - ${renderServiceLine(s)}`);
    }
    lines.push("");
    lines.push("Emphasis rules:");
    lines.push("  - [focus] services: lean toward them when they fit the customer's stated needs.");
    lines.push("  - [normal] services: mention as appropriate.");
    lines.push("  - [de-emphasize] services: do NOT proactively propose. Only mention if the customer explicitly asks about that capability.");
    lines.push("");
  }

  // Target markets
  if (profile.targetMarkets.length > 0) {
    lines.push(`Target markets: ${profile.targetMarkets.join(", ")}.`);
    lines.push("");
  }

  // Differentiators
  if (profile.differentiators.length > 0) {
    lines.push("Differentiators (why customers pick us):");
    for (const d of profile.differentiators) {
      lines.push(`  - ${d}`);
    }
    lines.push("");
  }

  // Out of scope
  if (profile.outOfScope.length > 0) {
    lines.push("Out of scope (do NOT propose):");
    for (const o of profile.outOfScope) {
      lines.push(`  - ${o}`);
    }
    lines.push("");
  }

  // Win stories
  if (profile.winStories.length > 0) {
    lines.push("Real wins we can cite (use these in objection handling and outreach when industry matches):");
    for (const w of profile.winStories) {
      const industryLabel = w.industry === "ANY" ? "Any industry" : w.industry;
      lines.push(`  - [${industryLabel}] ${w.situation.trim()} → ${w.outcome.trim()}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function renderServiceLine(s: ServiceLineProfile): string {
  const name = s.serviceLine.replace(/_/g, " ");
  const note = s.note?.trim();
  return note
    ? `${name} [${s.emphasis}] — ${note}`
    : `${name} [${s.emphasis}]`;
}
