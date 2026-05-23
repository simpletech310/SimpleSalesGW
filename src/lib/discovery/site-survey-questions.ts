import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * MSP Site Survey — full-fidelity discovery questionnaire mirroring
 * 01-MSP-Site-Survey/MSP_Site_Survey_TEMPLATE.md. ~120 questions across
 * 15+ sections from client profile through facilities.
 *
 * Row-level inventory (Sites, Circuits, Firewalls, Switches, APs, Servers,
 * Storage, Endpoints, Licenses, Vendors) lives in the structured Inventory
 * Workbook on the Customer detail — this questionnaire captures narrative,
 * intent, and qualitative judgments around that inventory.
 */

// helpers
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
function date(id: string, section: string, prompt: string, required = false): DiscoveryQuestion {
  return { id, section, prompt, type: "date", required };
}

export const SITE_SURVEY_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // 1. Client Profile
  text("CP01", "Client Profile", "Legal business name", undefined, true),
  text("CP02", "Client Profile", "Doing-business-as (DBA) name(s)"),
  num("CP03", "Client Profile", "Year founded"),
  text("CP04", "Client Profile", "Primary industry / vertical"),
  num("CP05", "Client Profile", "Total employee headcount"),
  num("CP06", "Client Profile", "Total endpoint count (workstations + servers + mobile)"),
  text("CP07", "Client Profile", "Brief description of what the business does"),
  text("CP08", "Client Profile", "Primary mission-critical processes (what must never go down)"),
  text("CP09", "Client Profile", "Annual IT spend (or your best estimate)"),
  single("CP10", "Client Profile", "Current IT support model", [
    { value: "in_house_team", label: "In-house IT team" },
    { value: "single_person", label: "Single in-house IT person" },
    { value: "msp", label: "Current MSP" },
    { value: "co_managed", label: "Co-managed (in-house + MSP)" },
    { value: "informal", label: "Informal / office manager" },
    { value: "none", label: "Nobody" },
  ]),

  // 2. Compliance Frameworks
  multi("CF01", "Compliance Frameworks", "Active regulatory obligations", [
    { value: "HIPAA", label: "HIPAA" },
    { value: "PCI", label: "PCI-DSS" },
    { value: "CMMC", label: "CMMC / NIST 800-171" },
    { value: "GLBA", label: "GLBA" },
    { value: "FTC", label: "FTC Safeguards" },
    { value: "SEC", label: "SEC cyber rules" },
    { value: "FERPA", label: "FERPA" },
    { value: "STATE_PRIVACY", label: "State privacy law (CCPA / etc.)" },
    { value: "SOC2", label: "SOC 2" },
    { value: "ISO27001", label: "ISO 27001" },
    { value: "NONE", label: "None" },
  ]),
  bool("CF02", "Compliance Frameworks", "Carry cyber insurance?"),
  date("CF03", "Compliance Frameworks", "Cyber insurance renewal date"),
  text("CF04", "Compliance Frameworks", "Insurance carrier + policy contact"),
  bool("CF05", "Compliance Frameworks", "Received a third-party security questionnaire in the last 12 months?"),
  text("CF06", "Compliance Frameworks", "Most recent independent audit (when + result)"),
  text("CF07", "Compliance Frameworks", "Known compliance gaps the client has acknowledged"),
  text("CF08", "Compliance Frameworks", "Regulated data types handled (PHI / PII / PCI / CUI / etc.)"),

  // 3. Stakeholder Map
  text("ST01", "Stakeholder Map", "Executive sponsor (name + title)", undefined, true),
  text("ST02", "Stakeholder Map", "Primary IT decision-maker (name + title)", undefined, true),
  text("ST03", "Stakeholder Map", "Day-to-day technical contact (name + title)"),
  text("ST04", "Stakeholder Map", "Compliance / security owner (if separate)"),
  text("ST05", "Stakeholder Map", "Finance / procurement contact"),
  text("ST06", "Stakeholder Map", "Key vendors with admin access (M365 / Google / firewall / etc.)"),
  text("ST07", "Stakeholder Map", "Anyone else who must be looped in"),

  // 4. Sites & Physical
  num("SP01", "Sites & Physical", "Number of physical locations", true),
  text("SP02", "Sites & Physical", "Primary site address (street, city, state, zip)"),
  text("SP03", "Sites & Physical", "Other site addresses (one per line)"),
  text("SP04", "Sites & Physical", "Square footage of primary site"),
  num("SP05", "Sites & Physical", "Headcount at primary site"),
  bool("SP06", "Sites & Physical", "Is any site shared with other tenants?"),
  bool("SP07", "Sites & Physical", "Are any sites planned to open / close / move in next 12 months?"),
  text("SP08", "Sites & Physical", "Notes about physical environment (server room, IDF closets, etc.)"),

  // 5. WAN
  text("WAN01", "WAN", "Primary internet provider at primary site"),
  text("WAN02", "WAN", "Primary site bandwidth (down / up)"),
  text("WAN03", "WAN", "Static IPs assigned (count + range)"),
  bool("WAN04", "WAN", "Failover / secondary WAN link present?"),
  text("WAN05", "WAN", "Failover provider + bandwidth"),
  single("WAN06", "WAN", "Inter-site connectivity model", [
    { value: "site_to_site_vpn", label: "Site-to-site VPN" },
    { value: "sd_wan", label: "SD-WAN" },
    { value: "mpls", label: "MPLS" },
    { value: "vpn_software", label: "Software VPN per user" },
    { value: "none", label: "No interconnect" },
    { value: "single_site", label: "Single site" },
  ]),
  text("WAN07", "WAN", "SD-WAN / VPN vendor (if any)"),
  num("WAN08", "WAN", "Internet circuits across all sites"),
  text("WAN09", "WAN", "Monthly WAN spend across all sites"),
  text("WAN10", "WAN", "Known WAN performance issues"),

  // 6. LAN — Firewalls
  text("FW01", "LAN · Firewalls", "Firewall vendor(s)"),
  text("FW02", "LAN · Firewalls", "Firewall models in use"),
  text("FW03", "LAN · Firewalls", "Firewall firmware version + last update date"),
  bool("FW04", "LAN · Firewalls", "Firewall under active support contract?"),
  date("FW05", "LAN · Firewalls", "Hardware EOL date (oldest unit)"),

  // 7. LAN — Switching
  text("SW01", "LAN · Switching", "Switch vendor(s)"),
  num("SW02", "LAN · Switching", "Total switch count across all sites"),
  single("SW03", "LAN · Switching", "Switch management model", [
    { value: "managed_centralized", label: "Centrally managed (Meraki / DNA / Aruba Central / etc.)" },
    { value: "managed_per_device", label: "Managed per device" },
    { value: "unmanaged", label: "Unmanaged" },
    { value: "mixed", label: "Mixed" },
  ]),
  text("SW04", "LAN · Switching", "Switch firmware / EOL concerns"),

  // 8. LAN — Wireless
  text("WL01", "LAN · Wireless", "Wireless vendor(s)"),
  num("WL02", "LAN · Wireless", "Approximate AP count"),
  multi("WL03", "LAN · Wireless", "SSIDs in use", [
    { value: "corp", label: "Corporate (auth'd)" },
    { value: "byod", label: "BYOD" },
    { value: "guest", label: "Guest (open or captive portal)" },
    { value: "iot", label: "IoT / cameras / printers" },
    { value: "voice", label: "Voice / VoIP-dedicated" },
  ]),
  bool("WL04", "LAN · Wireless", "Are guest and corporate SSIDs isolated at L2/L3?"),

  // 9. LAN — Segmentation
  bool("SEG01", "LAN · Segmentation", "VLANs in use?"),
  text("SEG02", "LAN · Segmentation", "VLAN scheme (data / voice / guest / IoT / management)"),
  bool("SEG03", "LAN · Segmentation", "Internal firewalling between VLANs?"),

  // 10. Servers / Virtualization
  num("SV01", "Servers", "Physical server count"),
  num("SV02", "Servers", "Virtual server count"),
  text("SV03", "Servers", "Hypervisor(s) in use (VMware / Hyper-V / Proxmox / etc.)"),
  text("SV04", "Servers", "Critical line-of-business apps + where hosted"),
  text("SV05", "Servers", "On-prem domain controllers / file servers"),
  bool("SV06", "Servers", "Any servers running EOL operating systems?"),
  text("SV07", "Servers", "Server room cooling + UPS / generator coverage"),
  text("SV08", "Servers", "Known server-side performance / capacity issues"),

  // 11. Cloud
  multi("CL01", "Cloud", "Primary cloud platforms in use", [
    { value: "m365", label: "Microsoft 365" },
    { value: "gws", label: "Google Workspace" },
    { value: "azure", label: "Microsoft Azure" },
    { value: "aws", label: "AWS" },
    { value: "gcp", label: "Google Cloud" },
    { value: "other", label: "Other SaaS-heavy" },
  ]),
  text("CL02", "Cloud", "M365 / Google Workspace tenant id (if known)"),
  num("CL03", "Cloud", "Number of M365 / GWS licenses"),
  text("CL04", "Cloud", "License mix (Business Basic / Standard / Premium / E3 / E5 / etc.)"),
  bool("CL05", "Cloud", "Conditional access / context-aware access policies in place?"),
  bool("CL06", "Cloud", "Legacy auth disabled?"),
  text("CL07", "Cloud", "Other major SaaS apps (CRM, ERP, helpdesk, etc.)"),
  text("CL08", "Cloud", "Cloud monthly spend approximation"),

  // 12. Storage
  text("ST_S01", "Storage", "Primary file storage (on-prem fileserver / NAS / OneDrive / SharePoint / etc.)"),
  text("ST_S02", "Storage", "Capacity in use vs. provisioned"),
  text("ST_S03", "Storage", "Storage vendors + models"),
  bool("ST_S04", "Storage", "Is sensitive data segregated to restricted shares?"),
  text("ST_S05", "Storage", "Storage growth rate (TB/year approximation)"),

  // 13. Voice
  single("VC01", "Voice", "Phone system type", [
    { value: "hosted_voip", label: "Hosted VoIP" },
    { value: "on_prem_pbx", label: "On-prem PBX" },
    { value: "ms_teams_phone", label: "Microsoft Teams Phone" },
    { value: "cell_only", label: "Cell phones only" },
    { value: "other", label: "Other" },
  ]),
  text("VC02", "Voice", "Voice vendor / provider"),
  num("VC03", "Voice", "Approximate voice user count"),
  text("VC04", "Voice", "DID range / main numbers"),
  bool("VC05", "Voice", "Call recording or e911 considerations?"),

  // 14. Security Stack
  text("SS01", "Security", "Endpoint AV / EDR vendor"),
  text("SS02", "Security", "EDR coverage % of endpoints"),
  text("SS03", "Security", "DNS / web filter (if any)"),
  text("SS04", "Security", "Email security (vendor + feature set)"),
  text("SS05", "Security", "Phishing simulation / training platform"),
  text("SS06", "Security", "SIEM / log aggregation"),
  text("SS07", "Security", "MDR / SOC vendor (if any)"),
  text("SS08", "Security", "Privileged access management (PAM)"),
  text("SS09", "Security", "Last penetration test (when + result)"),
  text("SS10", "Security", "Last tabletop exercise"),

  // 15. Identity
  single("ID01", "Identity", "Primary IdP", [
    { value: "entra", label: "Microsoft Entra / Azure AD" },
    { value: "gws", label: "Google Workspace" },
    { value: "okta", label: "Okta" },
    { value: "on_prem_ad", label: "On-prem Active Directory" },
    { value: "hybrid", label: "Hybrid AD + Entra" },
    { value: "other", label: "Other" },
  ]),
  single("ID02", "Identity", "MFA coverage", [
    { value: "all", label: "All users" },
    { value: "admins_only", label: "Admins only" },
    { value: "most", label: "Most users" },
    { value: "few", label: "Few users" },
    { value: "none", label: "None" },
  ]),
  bool("ID03", "Identity", "Privileged-account review cadence (quarterly or better)?"),
  text("ID04", "Identity", "Service-account inventory (count + biggest concerns)"),
  bool("ID05", "Identity", "Joiner / mover / leaver (JML) process documented?"),
  text("ID06", "Identity", "Identity-related incidents in last 12 months"),

  // 16. Endpoints
  text("EP01", "Endpoints", "Endpoint management / RMM in use"),
  text("EP02", "Endpoints", "OS mix (Win / Mac / Linux / iOS / Android approx %)"),
  num("EP03", "Endpoints", "Average endpoint age (months)"),
  bool("EP04", "Endpoints", "Disk encryption enforced (BitLocker / FileVault)?"),
  bool("EP05", "Endpoints", "MDM in place for mobile devices?"),
  text("EP06", "Endpoints", "Endpoint refresh budget / cycle"),

  // 17. Backups & DR
  text("BK01", "Backups & DR", "Backup product / vendor"),
  text("BK02", "Backups & DR", "Backup destination(s) — local / cloud / both"),
  text("BK03", "Backups & DR", "Retention policy (days / weeks / months)"),
  single("BK04", "Backups & DR", "Last successful restore test", [
    { value: "lt_30", label: "Within 30 days" },
    { value: "lt_90", label: "Within 90 days" },
    { value: "lt_365", label: "Within a year" },
    { value: "never", label: "Never tested" },
    { value: "unsure", label: "Unsure" },
  ]),
  text("BK05", "Backups & DR", "RPO target (acceptable data loss window)"),
  text("BK06", "Backups & DR", "RTO target (time to recover)"),
  bool("BK07", "Backups & DR", "Immutable / offsite copies in place?"),
  text("BK08", "Backups & DR", "Disaster recovery plan status"),

  // 18. Collaboration
  text("CO01", "Collaboration", "Email + collaboration platform"),
  text("CO02", "Collaboration", "Chat / messaging tool (Teams / Slack / Google Chat)"),
  text("CO03", "Collaboration", "Video conferencing platform"),
  text("CO04", "Collaboration", "Project management / ticketing tool"),

  // 19. Physical Security
  single("PS01", "Physical Security", "Access control system", [
    { value: "keycard_centrally_managed", label: "Keycard, centrally managed" },
    { value: "keycard_legacy", label: "Keycard, legacy / unmanaged" },
    { value: "smart_lock", label: "Smart lock" },
    { value: "physical_keys", label: "Physical keys only" },
    { value: "none", label: "None" },
  ]),
  bool("PS02", "Physical Security", "Video surveillance in place?"),
  text("PS03", "Physical Security", "Cameras vendor + retention"),
  text("PS04", "Physical Security", "Visitor management / sign-in process"),

  // 20. Facilities
  text("FA01", "Facilities", "UPS / generator coverage at primary site"),
  text("FA02", "Facilities", "Server-room cooling status"),
  text("FA03", "Facilities", "Any planned facility work (build-out / move) in next 12 months?"),

  // 21. Open notes
  text("NOTES", "Notes", "Anything else the survey missed"),
];

export const SITE_SURVEY_BANK: DiscoveryBank = {
  kind: "SITE_SURVEY",
  questions: SITE_SURVEY_QUESTIONS,
};
