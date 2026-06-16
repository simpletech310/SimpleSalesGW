import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * v3.8 — Network assessment (~30 Q).
 * Circuits, firewall, switching, routing/VPN, redundancy, addressing, and
 * documentation. Feeds `network.ts` scoring → findings/risks/next steps
 * (EOL firewall, no failover, flat network, no docs, etc.).
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

export const NETWORK_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Sites & circuits
  num("NET01", "Sites & circuits", "How many sites is this network covering?", true),
  text("NET02", "Sites & circuits", "Primary ISP + circuit type (fiber, coax, fixed wireless)"),
  num("NET03", "Sites & circuits", "Primary download bandwidth (Mbps)?"),
  num("NET04", "Sites & circuits", "Primary upload bandwidth (Mbps)?"),
  single("NET05", "Sites & circuits", "Is there a secondary / failover circuit?", [
    { value: "auto", label: "Yes — automatic failover", weight: 2 },
    { value: "manual", label: "Yes — manual failover", weight: 1 },
    { value: "none", label: "No — single circuit", weight: 0 },
  ]),
  single("NET06", "Sites & circuits", "Static or dynamic public IP?", [
    { value: "static", label: "Static" },
    { value: "dynamic", label: "Dynamic" },
    { value: "unknown", label: "Unknown" },
  ]),

  // Firewall / edge
  text("NET07", "Firewall", "Firewall make / model", "e.g. WatchGuard T45, SonicWall TZ370, Meraki MX68", true),
  single("NET08", "Firewall", "Firewall age?", [
    { value: "lt3", label: "Under 3 years", weight: 2 },
    { value: "3to5", label: "3–5 years", weight: 1 },
    { value: "gt5", label: "5+ years / EOL", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  single("NET09", "Firewall", "Active security subscription / UTM license?", [
    { value: "active", label: "Active + current", weight: 2 },
    { value: "expired", label: "Expired", weight: 0 },
    { value: "none", label: "None / basic firewall only", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  multi("NET10", "Firewall", "Edge security features enabled", [
    { value: "ips", label: "IPS / IDS" },
    { value: "content", label: "Content / web filtering" },
    { value: "gav", label: "Gateway antivirus" },
    { value: "geo", label: "Geo-blocking" },
    { value: "ssl", label: "SSL inspection" },
    { value: "none", label: "None / unsure" },
  ]),

  // Switching
  num("NET11", "Switching", "Approx. number of switches?"),
  single("NET12", "Switching", "Managed or unmanaged switches?", [
    { value: "managed", label: "Managed", weight: 2 },
    { value: "mixed", label: "Mixed" , weight: 1 },
    { value: "unmanaged", label: "Unmanaged", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  text("NET13", "Switching", "Switch make / model(s)"),
  single("NET14", "Switching", "Is PoE needed/used (phones, APs, cameras)?", [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unknown", label: "Unknown" },
  ]),

  // Segmentation & routing
  single("NET15", "Segmentation", "Is the network segmented with VLANs?", [
    { value: "yes", label: "Yes — VLANs in use", weight: 2 },
    { value: "partial", label: "Partially", weight: 1 },
    { value: "flat", label: "No — flat network", weight: 0 },
    { value: "unknown", label: "Unknown", weight: 0 },
  ]),
  multi("NET16", "Segmentation", "Separate networks for…", [
    { value: "guest", label: "Guest" },
    { value: "voice", label: "Voice / VoIP" },
    { value: "iot", label: "IoT / cameras" },
    { value: "servers", label: "Servers" },
    { value: "none", label: "None" },
  ]),
  text("NET17", "Segmentation", "IP addressing scheme / subnets (if known)"),

  // Remote access / VPN
  single("NET18", "Remote access", "Remote access method?", [
    { value: "ztna", label: "ZTNA / SASE" },
    { value: "vpn", label: "Site-to-site / client VPN" },
    { value: "rdp", label: "RDP / published apps" },
    { value: "none", label: "None" },
  ]),
  bool("NET19", "Remote access", "Any site-to-site VPNs between locations?"),

  // Wireless presence (high level — Wi-Fi has its own bank)
  single("NET20", "Wireless", "Business-grade Wi-Fi present?", [
    { value: "yes", label: "Yes — managed APs" },
    { value: "consumer", label: "Consumer / SOHO gear" },
    { value: "none", label: "None" },
  ]),

  // Monitoring & docs
  single("NET21", "Monitoring", "Is the network monitored?", [
    { value: "rmm", label: "Yes — RMM / SNMP monitoring", weight: 2 },
    { value: "basic", label: "Basic / reactive", weight: 1 },
    { value: "none", label: "No", weight: 0 },
  ]),
  single("NET22", "Documentation", "Network documentation exists?", [
    { value: "current", label: "Yes — current diagram + IPAM", weight: 2 },
    { value: "stale", label: "Some / outdated", weight: 1 },
    { value: "none", label: "None", weight: 0 },
  ]),

  // Cabling & rack
  single("NET23", "Cabling", "Structured cabling condition?", [
    { value: "clean", label: "Clean / labeled" },
    { value: "okay", label: "Functional but messy" },
    { value: "poor", label: "Poor / needs rework" },
    { value: "unknown", label: "Unknown" },
  ]),
  text("NET24", "Cabling", "Cabling category (Cat5e/Cat6/Cat6a) + notes"),

  // Performance
  multi("NET25", "Performance", "Reported network issues", [
    { value: "slow", label: "Slow speeds" },
    { value: "drops", label: "Drops / instability" },
    { value: "wifi", label: "Wi-Fi dead spots" },
    { value: "vpn", label: "VPN problems" },
    { value: "voice", label: "Voice quality" },
    { value: "none", label: "None reported" },
  ]),
  text("NET26", "Performance", "Describe the worst recurring network problem"),

  // Growth & misc
  bool("NET27", "Growth", "Planned moves, adds, or new sites in 12 months?"),
  text("NET28", "Growth", "Growth / expansion notes"),
  bool("NET29", "Compliance", "Any regulatory driver for network controls (PCI, HIPAA, CMMC)?"),
  text("NET30", "Compliance", "Anything else the vCIO should capture about the network"),
];

export const NETWORK_BANK: DiscoveryBank = {
  kind: "NETWORK",
  questions: NETWORK_QUESTIONS,
};
