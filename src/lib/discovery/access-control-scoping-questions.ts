import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v2.17 — Access control pre-sale scoping bank.
 * ~25 questions. Focused on door count, hardware compatibility,
 * cardholder roster, and software/licensing sizing for the quote.
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

export const ACCESS_CONTROL_SCOPING_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // 1. Existing system
  single("A01", "Existing system", "What's in place today?", [
    { value: "none", label: "Nothing — physical keys only" },
    { value: "old_proximity", label: "Old proximity / keypad system" },
    { value: "modern_local", label: "Modern on-prem (server-based)" },
    { value: "modern_cloud", label: "Modern cloud-managed" },
    { value: "consumer", label: "Consumer / single-door (August, etc.)" },
  ], true),
  text("A02", "Existing system", "If existing — vendor + approximate age"),
  bool("A03", "Existing system", "Is the existing hardware being kept or replaced?"),

  // 2. Door count + type
  num("A04", "Doors", "Total doors to control", true),
  num("A05", "Doors", "Of those, how many are exterior?"),
  num("A06", "Doors", "How many are interior (between rooms / departments)?"),
  num("A07", "Doors", "How many are mantraps or double-door interlocks?"),
  num("A08", "Doors", "How many emergency-exit doors (alarm + status only)?"),

  // 3. Door hardware
  multi("A09", "Door hardware", "Existing door hardware present (per door)", [
    { value: "electric_strike", label: "Electric strikes" },
    { value: "maglock", label: "Mag locks" },
    { value: "panic_bars", label: "Panic bars" },
    { value: "rex", label: "Request-to-exit (REX) buttons" },
    { value: "door_contacts", label: "Door-position contacts" },
    { value: "none", label: "None — needs new hardware" },
  ]),
  bool("A10", "Door hardware", "Power available at each door (or needs new run)?"),
  bool("A11", "Door hardware", "Cabling already in place to each door?"),

  // 4. Credentials
  single("A12", "Credentials", "Primary credential type", [
    { value: "card_prox", label: "Proximity card (125 kHz)" },
    { value: "card_smart", label: "Smart card / iCLASS / DESFire" },
    { value: "fob", label: "Key fob" },
    { value: "mobile", label: "Mobile phone (NFC / BLE)" },
    { value: "biometric", label: "Biometric (fingerprint, face)" },
    { value: "pin", label: "PIN keypad" },
    { value: "mixed", label: "Mixed" },
  ], true),
  num("A13", "Credentials", "Total cardholders / users to enroll", true),
  num("A14", "Credentials", "Number of distinct access groups (executives, staff, vendors, etc.)"),

  // 5. Software + schedules
  single("A15", "Software", "Cloud-managed vs on-prem preference", [
    { value: "cloud", label: "Cloud-managed (preferred)" },
    { value: "on_prem", label: "On-prem (must remain local)" },
    { value: "either", label: "Either / no preference" },
  ]),
  bool("A16", "Software", "Will they need SSO integration (M365 / Google)?"),
  bool("A17", "Software", "Schedule-based access (open during business hours, locked after)?"),
  bool("A18", "Software", "Visitor / temporary credential workflow needed?"),

  // 6. Integrations
  multi("A19", "Integrations", "Integrations needed", [
    { value: "video", label: "Video surveillance (correlate events)" },
    { value: "alarm", label: "Alarm system" },
    { value: "intercom", label: "Intercom / video doorbell" },
    { value: "hr", label: "HR system (auto-provision/deprovision)" },
    { value: "none", label: "None" },
  ]),

  // 7. Compliance + audit
  multi("A20", "Compliance & audit", "Compliance drivers", [
    { value: "hipaa", label: "HIPAA — control of clinical / records areas" },
    { value: "pci", label: "PCI — control of cardholder data zones" },
    { value: "cmmc", label: "CMMC / NIST 800-171 — controlled areas" },
    { value: "soc2", label: "SOC 2 — physical access controls" },
    { value: "none", label: "None" },
  ]),
  bool("A21", "Compliance & audit", "Audit log / report exports required?"),
  bool("A22", "Compliance & audit", "Real-time alerts on forced/held-open doors?"),

  // 8. Install
  bool("A23", "Install", "Building occupied during install (after-hours required)?"),
  text("A24", "Install", "Any landlord / property-management permissions needed?"),
  num("A25", "Install", "Target go-live date — weeks from now"),
];

export const ACCESS_CONTROL_SCOPING_BANK: DiscoveryBank = {
  kind: "ACCESS_CONTROL_SCOPING",
  questions: ACCESS_CONTROL_SCOPING_QUESTIONS,
};
