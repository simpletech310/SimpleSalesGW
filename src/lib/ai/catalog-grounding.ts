/**
 * v3.3.14 — AI catalog grounding.
 *
 * Every AI prompt that recommends services now gets a grounded block
 * that does two things:
 *
 *   1. Lists EXACTLY what Gateway sells (bundles + standalone lines +
 *      per-unit line items) with sticker pricing pulled from the live
 *      catalog. The AI cannot invent services not in this list.
 *
 *   2. Carries real-world sizing heuristics — "4-camera retail with
 *      1-2 entries", "24-camera bank", "13 VoIP extensions for a 13-
 *      seat office plus 2 conference phones", etc. — so quantities
 *      are sensible instead of guessed.
 *
 * The prompts using this block include vCIO plan generator, sales
 * coach, presale narrative writer, research summarizer, outreach
 * personalizer, and objection coach.
 */

import { bundleIncludesNormalized, fmtUsd, listBundles, type PricingCatalog } from "@/lib/pricing/catalog";
import { LINE_ITEM_STICKERS } from "@/lib/pricing/deal-kinds";
import { ServiceLine } from "@prisma/client";

/**
 * Industry sizing heuristics. Reps describe an industry and the AI
 * picks the appropriate band. These are real-world rules of thumb
 * from the SOP / Internal Pricing Sheet — not invented.
 */
export const SIZING_HEURISTICS: ReadonlyArray<{
  topic: string;
  rules: ReadonlyArray<string>;
}> = [
  {
    topic: "Video surveillance — camera count by industry + footprint",
    rules: [
      "Single-entrance small retail / boutique (<1,500 sqft): 4-6 cameras (front door interior, exterior, register, back room)",
      "Multi-entrance retail / 2-3 zones: 8-12 cameras (each entry + sales floor + stockroom + back exit)",
      "Office (single floor, <50 seats): 4-8 cameras (entry, hallway, conference room exterior, server-room door)",
      "Office (multi-floor, 50-200 seats): 12-20 cameras (entry + per-floor lobby + stairwell + server room + parking entrance)",
      "Bank / credit union (full branch): 18-24 cameras (vault interior, vault hallway, teller line, lobby, ATM lane, exterior 4-corners, parking, drive-thru)",
      "Medical clinic (single suite): 6-10 cameras (waiting room, reception, hallway, lab door, pharmacy, exterior)",
      "Restaurant / hospitality: 10-16 cameras (POS each station, kitchen, walk-in, host stand, dining, patio, exterior, parking)",
      "Manufacturing / warehouse: 12-24+ cameras (bays, loading docks, materials cage, shop floor, office area)",
      "Cannabis dispensary (compliance-driven): 24-32+ cameras (every transaction point, vault, storage, both sides of all entries)",
      "ANY camera count drives matching NVR/DVR sizing: 1 NVR per ~16 cameras, + storage for the required retention",
    ],
  },
  {
    topic: "Access control — door count by industry + layout",
    rules: [
      "Single-tenant small office: 1-2 doors (front + back/loading)",
      "Multi-suite office: 1 reader per suite door + 1 main exterior + 1 IT/server room",
      "Medical clinic: 4-6 doors (front, exam corridor, lab, records, pharmacy / controlled-substance closet)",
      "Bank branch: 6-10 doors (front lobby, vault, vault corridor, employee, back-of-house, secure document storage, IT closet)",
      "Manufacturing: 4-8 doors (front + shop floor + materials cage + offices + receiving + roof access)",
      "Multi-floor: add 1 per floor for stairwell / elevator lobby",
      "Always include the IT / network closet door — auditors look for it",
      "Each door = 1 reader + REX (request-to-exit) + electric strike or mag-lock + cloud licensing",
    ],
  },
  {
    topic: "VoIP / phones — extension count + add-ons",
    rules: [
      "1 extension per knowledge-worker seat (CPA, attorney, consultant, admin)",
      "Retail / hospitality: 1 per workstation/POS station + 1 shared back-of-house",
      "Manufacturing: 1 per office worker + 1 shop floor + 1 receiving + 1 conference room",
      "Add conference-room phones: 1 per conference room (separate hardware SKU)",
      "Add reception / lobby phones: 1 per public-facing desk",
      "Auto-attendant + ring groups + voicemail-to-email are included in the standalone VoIP per-seat fee",
      "Always confirm fax: if they fax, scope an eFax line or fax-to-email — quote separately, not a phone extension",
      "Example: 13-seat CPA office → 13 extensions + 1 conference phone + 1 fax line",
    ],
  },
  {
    topic: "Structured cabling — drop counting",
    rules: [
      "2 drops per knowledge-worker desk (data + voice, or dual data for failover)",
      "1 drop per camera (PoE)",
      "1 drop per access control door",
      "1 drop per printer / MFP / copier",
      "1 drop per WAP (wireless access point) — typically 1 per ~1,500 sqft",
      "1 drop per conference room display / TV",
      "New build: drops should be Cat6a; existing-supplement: match existing rating",
      "Test + certify each drop — cert report is included in our per-drop sticker",
    ],
  },
  {
    topic: "Managed IT — sizing thresholds",
    rules: [
      "Foundation bundle: 10-150 seats, single or dual location",
      "Professional bundle: 25-250 seats, adds voice + access control",
      "Compliance+ bundle: 25-250 seats with HIPAA / PCI / CMMC / cyber-insurance pressure",
      "Enterprise: 150-2000+ seats, multi-site, regulated, needs dedicated TAM",
      "Below 10 seats: usually break/fix territory — propose Foundation only if executive sponsor is sold on managed",
      "Above 250 seats and not regulated: still Professional; above 250 + regulated → Enterprise",
    ],
  },
  {
    topic: "Cybersecurity baseline (insurance + audit triggers)",
    rules: [
      "MFA on every account: non-negotiable for cyber-insurance renewals",
      "EDR (managed): replaces basic AV; required for most policies > $1M",
      "DNS / web filter: closes the second-largest breach vector after MFA",
      "Phishing simulation + training: quarterly, more often for regulated clients",
      "SIEM / log aggregation: required for SOC2 + most CMMC L2 controls",
    ],
  },
  {
    topic: "NIST / compliance — when to lead with it",
    rules: [
      "DoD prime / sub-contractor handling CUI → 800-171 + CMMC L2 path",
      "Healthcare with PHI → HIPAA crosswalk; NIST CSF Industry Crosswalk fits",
      "PCI processors → quarterly ASV scans + annual SAQ or AOC; we map to CSF",
      "Cyber-insurance renewal questionnaire → run the CSF Baseline before they answer; gives them defensible answers",
      "If no compliance driver is mentioned, do NOT lead with NIST",
    ],
  },
  {
    topic: "AI advisory — qualification cues",
    rules: [
      "Leader mentions Copilot / ChatGPT / 'we should use AI' → propose the Workshop tier",
      "They have a defined process pain (intake, scheduling, reporting) → Advisory tier with one pilot",
      "They've already done a pilot or have a budget line → Implementation tier",
      "Skip if they haven't mentioned AI — don't push it",
    ],
  },
  {
    topic: "Expansion / new-build triggers",
    rules: [
      "New office in next 6 months → cabling + voice + access + cameras all live; don't quote just one",
      "Existing site moving → cabling + voice + facilities sequence with hard date dependency",
      "Acquiring another company / location → multi-site managed IT + standardization sweep",
    ],
  },
];

function isStringIncl(entry: { serviceLine: ServiceLine; tier?: string }): string {
  return entry.tier ? `${entry.serviceLine} (${entry.tier})` : entry.serviceLine;
}

/**
 * Render the live pricing catalog as a markdown reference block.
 * Bundles first (with seat tiers + per-seat MRR + onboarding + annual
 * add-ons), then standalone service lines, then per-unit line items
 * the project deals use.
 */
export function renderCatalogBlock(catalog: PricingCatalog): string {
  const lines: string[] = [];
  lines.push("## Gateway service catalog (recommendations must come from this list ONLY)");
  lines.push("");
  lines.push("### Bundles (recurring + onboarding)");
  for (const b of listBundles(catalog)) {
    if (b.seatTiers.length === 0) {
      lines.push(`- ${b.label}: scoped per engagement (no fixed sticker)`);
      continue;
    }
    const tiersStr = b.seatTiers
      .map((t) => `${t.minSeats}-${t.maxSeats} seats ${fmtUsd(t.perSeatMrr)}/seat/mo (floor ${fmtUsd(t.perSeatFloor)})`)
      .join("; ");
    const includes = bundleIncludesNormalized(b).map(isStringIncl).join(", ");
    const annual = b.annualAddOns && b.annualAddOns.length > 0
      ? ` — annual add-ons: ${b.annualAddOns.map((a) => `${a.label} ${fmtUsd(a.amount)}`).join(", ")}`
      : "";
    lines.push(`- **${b.label}** — ${b.description}`);
    lines.push(`  - Tiers: ${tiersStr}`);
    lines.push(`  - Includes: ${includes}`);
    lines.push(`  - Onboarding: ${fmtUsd(b.onboarding.base)} base + ${fmtUsd(b.onboarding.perSeat)}/seat${annual}`);
  }

  lines.push("");
  lines.push("### Standalone service lines (per-seat MRR or one-time)");
  for (const [line, entry] of Object.entries(catalog.standalone)) {
    if (!entry) continue;
    const mrr = entry.perSeatMrr > 0 ? `${fmtUsd(entry.perSeatMrr)}/seat/mo (floor ${fmtUsd(entry.perSeatFloor)})` : "no MRR";
    const oneTime = entry.oneTime > 0 ? `${fmtUsd(entry.oneTime)} one-time` : "scoped per engagement";
    lines.push(`- ${line}: ${mrr}; ${oneTime}`);
  }

  lines.push("");
  lines.push("### Per-unit line items (project deals — voice / cabling / access / video)");
  for (const [, item] of Object.entries(LINE_ITEM_STICKERS)) {
    const mrr = item.perUnitMrr > 0 ? `${fmtUsd(item.perUnitMrr)}/unit/mo` : "no MRR";
    const ot = item.perUnitOneTime > 0 ? `${fmtUsd(item.perUnitOneTime)} one-time` : "scoped";
    lines.push(`- **${item.label}** — ${mrr}; ${ot}. ${item.helpText}`);
  }

  lines.push("");
  lines.push("### Real-world sizing heuristics (use these to choose quantities)");
  for (const h of SIZING_HEURISTICS) {
    lines.push(`**${h.topic}**`);
    for (const r of h.rules) lines.push(`- ${r}`);
    lines.push("");
  }

  lines.push("### Grounding rules (hard constraints)");
  lines.push("- ONLY recommend services that appear in the catalog above. Do NOT invent services, vendors, or product names.");
  lines.push("- When recommending a quantity (cameras, doors, extensions, drops), use the sizing heuristics above + the customer's seat count + industry + site count.");
  lines.push("- Always show your math when you propose a quantity: '4 cameras = 1 front, 1 register, 1 stockroom, 1 exterior'.");
  lines.push("- If the customer's need genuinely doesn't fit our catalog, say so plainly — don't bend the catalog to fit.");
  lines.push("- Cite the bundle or standalone line by its exact label so downstream code can match it to LINE_ITEM_STICKERS / ServiceLine enums.");

  return lines.join("\n");
}

/** Convenience: render the block from the live catalog. */
export async function loadCatalogBlock(): Promise<string> {
  const { loadCatalog } = await import("@/lib/pricing/loader");
  const catalog = await loadCatalog();
  return renderCatalogBlock(catalog);
}
