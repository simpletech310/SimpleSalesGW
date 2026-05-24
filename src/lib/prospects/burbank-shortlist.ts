import { Industry, ComplianceDriver, MspSatisfaction, PipelineStage, LeadSource } from "@prisma/client";

/**
 * v2.14 — manifest derived from docs/prospects-burbank.md.
 *
 * Why a TS constant instead of parsing the markdown at runtime: the prose
 * shape of that doc is for humans; the structured fields we need to seed
 * a Lead are a precise subset. Keeping them in code lets the new-lead form
 * picker auto-complete from this list AND the bulk-import script use the
 * same source of truth, with full type safety.
 *
 * Update both places (markdown + this file) if the shortlist changes.
 */

export type ProspectSeed = {
  businessName: string;
  industry: Industry;
  seatCount: number | null;
  siteCount: number;
  addressCity: string;
  addressState: string;
  websiteUrl: string | null;
  complianceDrivers: ComplianceDriver[];
  currentMspSatisfaction: MspSatisfaction;
  researchSummary: string;
  primaryContactTitle: string | null;
  /** Marketing tier — A = call this week, B = next round, C = courtesy */
  tier: "A" | "B" | "C";
};

export const BURBANK_PROSPECTS: ReadonlyArray<ProspectSeed> = [
  // ── Tier A ──────────────────────────────────────────────────────────
  {
    businessName: "Elevate Health Group",
    industry: Industry.MEDICAL,
    seatCount: 60,
    siteCount: 3,
    addressCity: "Glendale",
    addressState: "CA",
    websiteUrl: "https://elevatehealthgroup.com",
    complianceDrivers: [ComplianceDriver.HIPAA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Multi-site primary care practice (Glendale, Burbank, La Cañada). HIPAA pressure + multi-location → SD-WAN + structured cabling + Hosted Voice play. Suggested bundle: Managed IT Pro + HIPAA overlay + Hosted Voice.",
    primaryContactTitle: "Practice Administrator",
    tier: "A",
  },
  {
    businessName: "ComCare Primary Medical Group",
    industry: Industry.MEDICAL,
    seatCount: 200,
    siteCount: 14,
    addressCity: "Glendale",
    addressState: "CA",
    websiteUrl: "https://comcaremed1.org",
    complianceDrivers: [ComplianceDriver.HIPAA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "14 locations across Glendale/Burbank/Highland Park/Hollywood. Centralized MSP + managed network is the obvious sell. Multilingual staff → high phone volume. Bundle: Managed IT Pro + HIPAA + Hosted Voice + SD-WAN.",
    primaryContactTitle: "Practice Manager",
    tier: "A",
  },
  {
    businessName: "Sherman Oaks Dental Group",
    industry: Industry.MEDICAL,
    seatCount: 50,
    siteCount: 3,
    addressCity: "Sherman Oaks",
    addressState: "CA",
    websiteUrl: "https://shermanoaksdentalgroup.com",
    complianceDrivers: [ComplianceDriver.HIPAA, ComplianceDriver.PCI],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Multi-specialty multi-site dental since 1996. HIPAA + PCI (card-on-file). Imaging file shares on aging on-prem → easy modernize pitch. Bundle: Managed IT Pro + HIPAA/PCI.",
    primaryContactTitle: "Office Manager",
    tier: "A",
  },
  {
    businessName: "Pacific Dental Group",
    industry: Industry.MEDICAL,
    seatCount: 40,
    siteCount: 2,
    addressCity: "North Hollywood",
    addressState: "CA",
    websiteUrl: "https://pdgnorthhollywood.com",
    complianceDrivers: [ComplianceDriver.HIPAA, ComplianceDriver.PCI],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Multi-site dental (NoHo + Sherman Oaks). Co-managed IT may fit if a part-time IT lead is on staff. Bundle: Co-Managed IT + HIPAA.",
    primaryContactTitle: "Office Manager",
    tier: "A",
  },
  {
    businessName: "Exer Urgent Care",
    industry: Industry.MEDICAL,
    seatCount: 250,
    siteCount: 30,
    addressCity: "North Hollywood",
    addressState: "CA",
    websiteUrl: "https://exerurgentcare.com",
    complianceDrivers: [ComplianceDriver.HIPAA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Whale. 30+ urgent-care locations across LA County. Multi-site network + POS + EMR convergence = Gateway's structured-cabling + managed-network sweet spot. Long sales cycle but deal-defining. Bundle: Enterprise MSP + SD-WAN + Hosted Voice.",
    primaryContactTitle: "VP IT / Director of Operations",
    tier: "A",
  },
  {
    businessName: "Brighton Hall School",
    industry: Industry.EDUCATION,
    seatCount: 45,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://brightonhallschool.org",
    complianceDrivers: [ComplianceDriver.FERPA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank K-12 independent school, flexible/online learning. Heavy cloud + collaboration reliance. Likely no dedicated IT lead. Bundle: Managed IT Pro + FERPA-friendly stack + Hosted Voice.",
    primaryContactTitle: "Head of School / Business Manager",
    tier: "A",
  },
  {
    businessName: "International School of Los Angeles — Burbank Campus",
    industry: Industry.EDUCATION,
    seatCount: 120,
    siteCount: 4,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://internationalschool.la",
    complianceDrivers: [ComplianceDriver.FERPA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Multi-campus (Burbank + LA + Pasadena + Orange County). Multi-site networking + secure inter-campus video. Bundle: Managed IT Pro + multi-site network + FERPA.",
    primaryContactTitle: "Director of Technology / COO",
    tier: "A",
  },
  {
    businessName: "ESM Aerospace, Inc.",
    industry: Industry.FEDERAL_CONTRACTING,
    seatCount: 75,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.CMMC, ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank-based AS9100, ITAR-registered aerospace sheet metal + CNC. CMMC L2 required to keep DoD subcontracts (final rule effective Dec 2024). NIST 800-171 work alone is six-figure. Bundle: Managed IT + CMMC L2 overlay + secure enclave.",
    primaryContactTitle: "Quality Manager / IT Lead",
    tier: "A",
  },
  {
    businessName: "S&H Machine",
    industry: Industry.FEDERAL_CONTRACTING,
    seatCount: 65,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://shmachine.com",
    complianceDrivers: [ComplianceDriver.CMMC, ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Commercial aviation + defense + spacecraft → mixed CUI/FCI. AS9100 + DDTC + ITAR. Without CMMC, future prime contracts at risk. Bundle: Managed IT + CMMC L2 + NIST 800-171.",
    primaryContactTitle: "Operations Manager / VP Engineering",
    tier: "A",
  },
  {
    businessName: "OSO Collection",
    industry: Industry.HOSPITALITY,
    seatCount: 80,
    siteCount: 2,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.PCI],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Boutique hospitality group (Hotel Burbank, Glendale Express +). PCI-DSS on POS + PMS, guest Wi-Fi at scale, IPTV, hosted voice. Bundle: Managed IT Pro + PCI + Hosted Voice + guest Wi-Fi.",
    primaryContactTitle: "Director of Operations / GM",
    tier: "A",
  },
  {
    businessName: "Azul Hospitality Group — The Glenmark Glendale",
    industry: Industry.HOSPITALITY,
    seatCount: 50,
    siteCount: 1,
    addressCity: "Glendale",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.PCI],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "85-room Marriott Tribute Portfolio. Land Glenmark cleanly → Azul's other SoCal properties become referrals. Bundle: Managed IT + PCI + Hosted Voice.",
    primaryContactTitle: "GM (Glenmark) → Azul VP IT",
    tier: "A",
  },

  // ── Tier B ──────────────────────────────────────────────────────────
  {
    businessName: "The Burbank Firm, L.C.",
    industry: Industry.LEGAL,
    seatCount: 25,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://theburbankfirm.com",
    complianceDrivers: [ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank law firm one block from Gateway (2312 W Victory Blvd). Advises 250+ SMB clients. Aging on-prem document management likely. Bundle: Managed IT + secure DM + Hosted Voice.",
    primaryContactTitle: "Managing Partner",
    tier: "B",
  },
  {
    businessName: "Gallenberg PC",
    industry: Industry.LEGAL,
    seatCount: 30,
    siteCount: 3,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://gallenberglaw.com",
    complianceDrivers: [ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank + LA + Beverly Hills employment-litigation boutique. Multi-office IT consolidation pitch. Bundle: Co-Managed IT + secure remote access.",
    primaryContactTitle: "Managing Attorney",
    tier: "B",
  },
  {
    businessName: "L.A. Financial Management",
    industry: Industry.FINANCIAL_SERVICES,
    seatCount: 15,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://la-financialmanagement.com",
    complianceDrivers: [ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank CPA serving 200+ LA SMBs (Lara C. Azoy). Client tax data → security overlay. Smaller seats but high LTV. Bundle: Managed IT + financial-data security.",
    primaryContactTitle: "Principal / Owner",
    tier: "B",
  },
  {
    businessName: "Bornazyan & Bornazyan LLP",
    industry: Industry.FINANCIAL_SERVICES,
    seatCount: 12,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://bbankcpa.com",
    complianceDrivers: [ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Burbank CPA practice. Bundle: Managed IT Lite + secure file exchange.",
    primaryContactTitle: "Partner",
    tier: "B",
  },
  {
    businessName: "Kelly+Partners Advisory Services (Neumeister)",
    industry: Industry.FINANCIAL_SERVICES,
    seatCount: 50,
    siteCount: 2,
    addressCity: "Pasadena",
    addressState: "CA",
    websiteUrl: "https://neumeistercpa.com",
    complianceDrivers: [ComplianceDriver.OTHER],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "20+ year Pasadena CPA + forensic accounting. Chain-of-custody / e-discovery angle. Bundle: Managed IT + secure doc handling + Hosted Voice.",
    primaryContactTitle: "Managing Director",
    tier: "B",
  },
  {
    businessName: "Glendale Memorial Medical Group / Allied Physicians",
    industry: Industry.MEDICAL,
    seatCount: 30,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.HIPAA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Family Medicine + PA group, Burbank base. Smaller deal but inbound-friendly given location. Bundle: Managed IT Lite + HIPAA.",
    primaryContactTitle: "Office Manager",
    tier: "B",
  },
  {
    businessName: "Unio Specialty Care — Genesis Healthcare GI",
    industry: Industry.MEDICAL,
    seatCount: 35,
    siteCount: 2,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://uniospecialtycare.com",
    complianceDrivers: [ComplianceDriver.HIPAA],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Specialty GI w/ imaging + endoscopy → larger PHI footprint than primary care. Multi-physician. Bundle: Managed IT Pro + HIPAA + imaging workflow.",
    primaryContactTitle: "Practice Administrator",
    tier: "B",
  },
  {
    businessName: "Community Foundation of the Verdugos",
    industry: Industry.NONPROFIT,
    seatCount: 15,
    siteCount: 1,
    addressCity: "Glendale",
    addressState: "CA",
    websiteUrl: "https://cfverdugos.org",
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Local community foundation since 1956 (Burbank/Glendale/La Cañada). Donor data + grant workflows. Bundle: Managed IT Lite (nonprofit pricing) + secure file exchange + Hosted Voice.",
    primaryContactTitle: "Executive Director",
    tier: "B",
  },
  {
    businessName: "Home Again Los Angeles",
    industry: Industry.NONPROFIT,
    seatCount: 20,
    siteCount: 1,
    addressCity: "Glendale",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Community housing nonprofit. Caseworker mobility (laptops + remote) + back-office IT. Bundle: Managed IT Lite + M365 nonprofit licensing.",
    primaryContactTitle: "Operations Director",
    tier: "B",
  },
  {
    businessName: "Logix Community Stars (Foundation)",
    industry: Industry.NONPROFIT,
    seatCount: 8,
    siteCount: 1,
    addressCity: "Burbank",
    addressState: "CA",
    websiteUrl: "https://custars.org",
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Foundation arm of Logix FCU. Connection to parent credit union (FINANCIAL_SERVICES + GLBA + ATM/branch network) is the real prize. Start with foundation, engineer path to parent.",
    primaryContactTitle: "Foundation Director",
    tier: "B",
  },

  // ── Tier C ──────────────────────────────────────────────────────────
  {
    businessName: "Fonco Studios",
    industry: Industry.PROFESSIONAL_SERVICES,
    seatCount: 45,
    siteCount: 1,
    addressCity: "San Fernando",
    addressState: "CA",
    websiteUrl: "https://foncostudios.com",
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "16,000 sq ft production studio (sound stages, post, costume, perf capture). Heavy on workstations + render + SAN. Bundle: Managed IT + structured cabling + high-throughput storage.",
    primaryContactTitle: "Studio Manager / Director of Operations",
    tier: "C",
  },
  {
    businessName: "Ajax Creative",
    industry: Industry.PROFESSIONAL_SERVICES,
    seatCount: 25,
    siteCount: 2,
    addressCity: "Los Angeles",
    addressState: "CA",
    websiteUrl: "https://ajaxcreative.com",
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Post-production house (editorial + VFX + color + sound + delivery). High-bandwidth, secure-handoff workflow. Bundle: Managed IT + secure asset transfer + Hosted Voice.",
    primaryContactTitle: "Studio Manager",
    tier: "C",
  },
  {
    businessName: "Jolt Design",
    industry: Industry.PROFESSIONAL_SERVICES,
    seatCount: 20,
    siteCount: 1,
    addressCity: "Los Angeles",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "Award-winning production/design studio. Mid-size creative agencies are notorious for tribal-IT-by-junior-designer; Gateway can professionalize. Bundle: Co-Managed IT + Hosted Voice.",
    primaryContactTitle: "Owner / Creative Director",
    tier: "C",
  },
  {
    businessName: "Forte Pictures",
    industry: Industry.PROFESSIONAL_SERVICES,
    seatCount: 30,
    siteCount: 2,
    addressCity: "Los Angeles",
    addressState: "CA",
    websiteUrl: null,
    complianceDrivers: [ComplianceDriver.NONE],
    currentMspSatisfaction: MspSatisfaction.NONE,
    researchSummary:
      "2x Emmy-winning shop based at Sony Pictures studios. On-lot IT covered; non-lot offices + remote post may be open. Bundle: Co-Managed IT for off-lot footprint.",
    primaryContactTitle: "Director of Production",
    tier: "C",
  },
];

/** Default pipeline stage + source for newly-imported prospects. */
export const PROSPECT_IMPORT_DEFAULTS = {
  pipelineStage: PipelineStage.LEAD,
  source: LeadSource.OUTBOUND,
} as const;
