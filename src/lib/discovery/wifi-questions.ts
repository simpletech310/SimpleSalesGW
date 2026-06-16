import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v3.8 — Wi-Fi assessment (~25 Q).
 * Access points, controller, coverage + dead spots, SSIDs, density, roaming,
 * and known issues. Feeds `wifi.ts` scoring → coverage/capacity risks + next
 * steps (survey needed, AP refresh, guest isolation, etc.).
 */

function single(id: string, section: string, prompt: string, options: ReadonlyArray<{ value: string; label: string; weight?: number }>, required = false): DiscoveryQuestion {
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

export const WIFI_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Footprint
  num("WIFI01", "Footprint", "Approx. square footage to cover?", true),
  num("WIFI02", "Footprint", "Number of floors?"),
  num("WIFI03", "Footprint", "How many buildings / sites?"),
  multi("WIFI04", "Footprint", "Environment types to cover", [
    { value: "office", label: "Office / desks" },
    { value: "warehouse", label: "Warehouse / high ceilings" },
    { value: "outdoor", label: "Outdoor / yard" },
    { value: "retail", label: "Retail floor" },
    { value: "medical", label: "Medical / clinical" },
    { value: "manufacturing", label: "Manufacturing" },
  ]),

  // Current gear
  num("WIFI05", "Current gear", "How many access points today?"),
  text("WIFI06", "Current gear", "AP vendor / model", "e.g. UniFi U6-Pro, Meraki MR, Aruba InstantOn"),
  single("WIFI07", "Current gear", "AP age?", [
    { value: "lt3", label: "Under 3 years", weight: 2 },
    { value: "3to5", label: "3–5 years", weight: 1 },
    { value: "gt5", label: "5+ years", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  single("WIFI08", "Current gear", "Newest Wi-Fi standard supported?", [
    { value: "wifi6e", label: "Wi-Fi 6E / 7" },
    { value: "wifi6", label: "Wi-Fi 6" },
    { value: "wifi5", label: "Wi-Fi 5 (ac)" },
    { value: "older", label: "Older (n/g)" },
    { value: "unknown", label: "Unknown" },
  ]),
  single("WIFI09", "Current gear", "Managed by a controller / cloud?", [
    { value: "cloud", label: "Cloud-managed", weight: 2 },
    { value: "controller", label: "On-prem controller", weight: 1 },
    { value: "standalone", label: "Standalone APs", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),

  // SSIDs & security
  multi("WIFI10", "SSIDs", "SSIDs in use", [
    { value: "corp", label: "Corporate / staff" },
    { value: "guest", label: "Guest" },
    { value: "iot", label: "IoT / devices" },
    { value: "byod", label: "BYOD" },
  ]),
  single("WIFI11", "Security", "Corporate Wi-Fi authentication?", [
    { value: "8021x", label: "802.1X / RADIUS", weight: 2 },
    { value: "psk", label: "WPA2/3 pre-shared key", weight: 1 },
    { value: "open", label: "Open / weak", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  single("WIFI12", "Security", "Is guest traffic isolated from the LAN?", [
    { value: "yes", label: "Yes — isolated", weight: 2 },
    { value: "no", label: "No", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  bool("WIFI13", "Security", "Captive portal / guest splash page needed?"),

  // Capacity
  num("WIFI14", "Capacity", "Peak concurrent client devices?"),
  single("WIFI15", "Capacity", "Device density profile", [
    { value: "high", label: "High (conf rooms, classrooms, events)" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low / sparse" },
  ]),
  bool("WIFI16", "Capacity", "Voice or video over Wi-Fi (soft-phones, calls)?"),
  bool("WIFI17", "Capacity", "Roaming required (move between APs without drop)?"),

  // Backhaul
  single("WIFI18", "Backhaul", "Are APs wired (PoE) or wireless-mesh?", [
    { value: "wired", label: "Wired PoE", weight: 2 },
    { value: "mixed", label: "Mixed", weight: 1 },
    { value: "mesh", label: "Wireless mesh", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  bool("WIFI19", "Backhaul", "Enough cable drops / PoE ports for planned APs?"),

  // Issues
  multi("WIFI20", "Issues", "Reported Wi-Fi problems", [
    { value: "deadspots", label: "Dead spots / no coverage" },
    { value: "drops", label: "Drops / disconnects" },
    { value: "slow", label: "Slow throughput" },
    { value: "roaming", label: "Roaming / sticky clients" },
    { value: "guest", label: "Guest network issues" },
    { value: "none", label: "None reported" },
  ]),
  text("WIFI21", "Issues", "Where are the worst dead spots / problem areas?"),
  bool("WIFI22", "Issues", "Has a wireless site survey ever been done?"),

  // Planning
  bool("WIFI23", "Planning", "Any layout/floorplan available for AP placement?"),
  bool("WIFI24", "Planning", "Planned expansion or new areas to cover?"),
  text("WIFI25", "Planning", "Anything else the vCIO should note about Wi-Fi"),
];

export const WIFI_BANK: DiscoveryBank = {
  kind: "WIFI",
  questions: WIFI_QUESTIONS,
};
