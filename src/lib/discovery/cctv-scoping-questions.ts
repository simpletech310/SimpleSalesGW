import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v2.17 — CCTV / video surveillance pre-sale scoping bank.
 * ~25 questions. Focused on what's needed to quote camera count,
 * NVR/storage sizing, install labor, and remote-viewing setup.
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

export const CCTV_SCOPING_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // 1. Existing
  single("C01", "Existing system", "What do they have today?", [
    { value: "none", label: "Nothing" },
    { value: "old_analog", label: "Old analog system (DVR + coax)" },
    { value: "old_ip", label: "Old IP system (functional but dated)" },
    { value: "recent_ip", label: "Recent IP system (working, adding more)" },
    { value: "consumer", label: "Consumer-grade (Ring/Nest/etc.)" },
  ], true),
  text("C02", "Existing system", "If existing — vendor + approximate age"),
  single("C03", "Existing system", "Is the existing system being replaced or extended?", [
    { value: "replace_all", label: "Replace everything" },
    { value: "keep_some", label: "Keep some, replace rest" },
    { value: "extend_only", label: "Pure extension / no replacement" },
    { value: "first_install", label: "First install — nothing to keep" },
  ]),

  // 2. Camera count + placement
  num("C04", "Camera count & placement", "Total cameras needed", true),
  num("C05", "Camera count & placement", "Of those, how many indoor?"),
  num("C06", "Camera count & placement", "How many outdoor / weatherproof?"),
  num("C07", "Camera count & placement", "How many parking-lot / long-range?"),
  num("C08", "Camera count & placement", "How many high-detail (license-plate or face-recognition)?"),
  text("C09", "Camera count & placement", "Walk-through summary of key camera locations"),

  // 3. Site
  num("C10", "Site", "Total square footage of the area to cover"),
  num("C11", "Site", "How many separate buildings / structures?"),
  bool("C12", "Site", "Multiple floors?"),
  single("C13", "Site", "Mount type preference", [
    { value: "ceiling", label: "Ceiling-mount preferred" },
    { value: "wall", label: "Wall-mount preferred" },
    { value: "mixed", label: "Mix as needed" },
    { value: "no_pref", label: "No preference" },
  ]),

  // 4. Retention + recording
  num("C14", "Retention & storage", "Required retention (days)", true),
  single("C15", "Retention & storage", "Recording continuity needs", [
    { value: "247", label: "24×7 continuous" },
    { value: "motion", label: "Motion-only" },
    { value: "scheduled", label: "Scheduled (business hours + motion off-hours)" },
  ]),
  bool("C16", "Retention & storage", "Off-site cloud backup required?"),

  // 5. NVR / recording infrastructure
  bool("C17", "NVR & infrastructure", "Is there a server room / IT closet for an NVR?"),
  bool("C18", "NVR & infrastructure", "Is PoE network available (or will switches be replaced)?"),
  num("C19", "NVR & infrastructure", "Estimated PoE budget needed (W) — best guess"),
  bool("C20", "NVR & infrastructure", "Existing cable runs reusable?"),

  // 6. Remote viewing + access
  single("C21", "Remote viewing", "How many people need remote-view access?", [
    { value: "owner_only", label: "Owner / one person only" },
    { value: "few", label: "2–5 people" },
    { value: "many", label: "6+ people (e.g. multiple managers)" },
  ]),
  bool("C22", "Remote viewing", "Mobile app access required?"),

  // 7. Compliance / unusual needs
  multi("C23", "Compliance & special", "Any of these apply?", [
    { value: "audio_recording", label: "Audio recording (legal review required)" },
    { value: "hipaa_areas", label: "HIPAA-restricted areas (no camera placement)" },
    { value: "pci_areas", label: "PCI areas (cardholder data zones)" },
    { value: "license_plate", label: "License-plate capture" },
    { value: "ai_analytics", label: "AI analytics (people-count, loitering, etc.)" },
  ]),
  text("C24", "Compliance & special", "Anything unusual about the install (after-hours, occupied building, etc.)"),
  num("C25", "Compliance & special", "Target go-live date — weeks from now"),
];

export const CCTV_SCOPING_BANK: DiscoveryBank = {
  kind: "CCTV_SCOPING",
  questions: CCTV_SCOPING_QUESTIONS,
};
