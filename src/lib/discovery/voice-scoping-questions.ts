import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v2.17 — Voice (phone system) pre-sale scoping bank.
 * ~25 questions. Goal: vCIO finishes in 15–20 min and Lin walks away
 * with enough detail to build an accurate ServiceQuoteCard quote
 * (extension count, hardware count, install labor, special features).
 *
 * Designed to feed `voice-scoping.ts` scoring which emits
 * `recommendedLineItems[]` ready to one-click adopt into the deal.
 */

function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "single_select", required, options };
}
function multi(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string }>, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "multi_select", required, options };
}
function text(id: string, section: string, prompt: string, helpText?: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, helpText, type: "text", required };
}
function num(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "numeric", required };
}
function bool(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "boolean", required };
}

export const VOICE_SCOPING_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // 1. Current system
  single("V01", "Current system", "What phone system are they on today?", [
    { value: "hosted_voip", label: "Hosted VoIP / cloud PBX" },
    { value: "on_prem_pbx", label: "On-prem PBX (analog or IP)" },
    { value: "teams_phone", label: "Microsoft Teams Phone" },
    { value: "cell_only", label: "Cell phones only / no business system" },
    { value: "other", label: "Other" },
  ], true),
  text("V02", "Current system", "Current vendor + system age (if known)"),
  single("V03", "Current system", "Why are they looking to switch?", [
    { value: "contract_end", label: "Contract ending / renewal" },
    { value: "cost", label: "Cost reduction" },
    { value: "features", label: "Need new features" },
    { value: "reliability", label: "Reliability issues" },
    { value: "move", label: "Office move / new location" },
    { value: "growth", label: "Growth — need scale" },
    { value: "other", label: "Other" },
  ]),

  // 2. Headcount & DIDs
  num("V04", "Headcount & DIDs", "Total extensions needed", true),
  num("V05", "Headcount & DIDs", "Of those, how many need a physical desk phone?"),
  num("V06", "Headcount & DIDs", "How many need a softphone / mobile app only?"),
  num("V07", "Headcount & DIDs", "How many conference rooms / shared spaces need a phone?"),
  num("V08", "Headcount & DIDs", "Number of direct DIDs to publish"),
  num("V09", "Headcount & DIDs", "How many e-fax numbers needed?"),

  // 3. Call patterns
  single("V10", "Call patterns", "Daily call volume (rough)", [
    { value: "low", label: "Low (< 50 inbound/day)" },
    { value: "medium", label: "Medium (50–200/day)" },
    { value: "high", label: "High (200–500/day)" },
    { value: "very_high", label: "Very high (500+/day, contact-center territory)" },
  ]),
  multi("V11", "Call patterns", "Routing needs", [
    { value: "auto_attendant", label: "Auto-attendant / IVR" },
    { value: "hunt_groups", label: "Hunt groups / ring strategies" },
    { value: "queues", label: "Call queues with hold music" },
    { value: "after_hours", label: "After-hours routing" },
    { value: "voicemail_to_email", label: "Voicemail-to-email" },
  ]),

  // 4. Port-out
  text("V12", "Port-out & numbers", "Carrier(s) the existing numbers are with"),
  bool("V13", "Port-out & numbers", "Will all existing numbers be ported in?"),
  text("V14", "Port-out & numbers", "Any numbers to leave behind (analog lines for alarm/elevator)?"),

  // 5. Hardware
  single("V15", "Hardware", "Handset preference", [
    { value: "yealink", label: "Yealink (standard)" },
    { value: "polycom", label: "Polycom" },
    { value: "byod", label: "Use existing handsets if compatible" },
    { value: "no_pref", label: "No preference — recommend" },
  ]),
  bool("V16", "Hardware", "Will they need any conference / boardroom phones (e.g. Polycom Trio)?"),
  num("V17", "Hardware", "If yes, how many conference phones?"),

  // 6. Network readiness
  single("V18", "Network readiness", "Is QoS / VLAN tagging in place for voice today?", [
    { value: "yes_documented", label: "Yes — documented" },
    { value: "yes_undocumented", label: "Yes — undocumented" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Unsure — need to check" },
  ]),
  single("V19", "Network readiness", "Internet bandwidth + redundancy posture", [
    { value: "fiber_redundant", label: "Fiber + redundant secondary" },
    { value: "fiber_only", label: "Single fiber, no failover" },
    { value: "cable_only", label: "Cable / DSL only" },
    { value: "unknown", label: "Unknown" },
  ]),

  // 7. Special needs
  bool("V20", "Special needs", "e911 / Kari's Law location reporting required?"),
  bool("V21", "Special needs", "Call recording required (legal / regulated)?"),
  bool("V22", "Special needs", "CRM / helpdesk integration needed (Salesforce, HubSpot, etc.)?"),
  text("V23", "Special needs", "Which CRM / app should it integrate with?"),
  bool("V24", "Special needs", "Any analog devices to keep (paging, intercom, elevator phones)?"),
  text("V25", "Special needs", "Anything unusual about the install (after-hours cutover, multi-site, etc.)?"),
];

export const VOICE_SCOPING_BANK: DiscoveryBank = {
  kind: "VOICE_SCOPING",
  questions: VOICE_SCOPING_QUESTIONS,
};
