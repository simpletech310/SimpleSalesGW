/**
 * v3.6 — B2B Rocket / bebop.ai CSV import preset.
 *
 * The B2B Rocket export is a *pre-researched* prospect list. Each row carries
 * a vendor fit Score, the Intent Topics that fired, a prose Description +
 * Reason (their research write-up), a Playbook URL, and up to three contacts
 * (name / title / email / phone / LinkedIn / location each).
 *
 * Rather than flatten that into a single primary contact (and throw the rest
 * away), this preset maps the rich columns onto the Lead's existing research
 * + enrichment surface so an imported lead lands fully briefed:
 *
 *   Company Name           → businessName
 *   Industry               → industry (mapped) + subindustry (raw label)
 *   Score                  → vendorLeadScore (+ vendorScoreSource)
 *   Intent Topics          → intentTopics[]
 *   Description            → researchSummary           (renders on Research tab)
 *   Reason                 → researchFitSignals[0]     (renders as a fit signal)
 *   Playbook URL           → playbookUrl
 *   Primary Contact *      → primaryContact* (email/phone pulled from the
 *                            matching numbered contact)
 *   Contact 1/2/3 *        → keyContacts[]             (renders as Decision-makers)
 *   ID                     → externalLeadId            (idempotent re-import key)
 *
 * Detection is by header signature so the same /leads/import page can sniff
 * the format and route to this preset automatically (see bulk-import route).
 */

import { Industry } from "@prisma/client";

const MAX_CONTACTS = 3;

/** A single key-contact entry, matching the JSON shape LeadTabs renders. */
export type KeyContact = {
  name: string;
  title?: string;
  role?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  location?: string;
  confidence?: number;
};

export type B2BRocketNormalized = {
  data?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * True when the CSV headers look like a B2B Rocket export. We require the
 * company column plus at least two of the format's signature columns so a
 * generic CSV that merely has a "Company Name" header isn't misrouted.
 */
export function isB2BRocketCsv(headers: string[]): boolean {
  const set = new Set(headers.map(norm));
  const hasCompany = set.has("companyname") || set.has("company");
  const signatures = [
    "intenttopics",
    "playbookurl",
    "contact1email",
    "contact1name",
    "contact1jobtitle",
    "primarycontactjobtitle",
    "reason",
  ];
  const hits = signatures.filter((s) => set.has(s)).length;
  return hasCompany && hits >= 2;
}

// ---------------------------------------------------------------------------
// Row normalization
// ---------------------------------------------------------------------------

/** Build a normalized-key → value lookup for one raw row. */
function lookup(raw: Record<string, string>): (...keys: string[]) => string {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) map[norm(k)] = v;
  return (...keys: string[]) => {
    for (const k of keys) {
      const v = map[norm(k)];
      if (v != null && v.trim() !== "") return v.trim();
    }
    return "";
  };
}

/** Map a free-text industry label onto the app's Industry enum. */
export function mapIndustry(raw: string): { industry: Industry; matched: boolean } {
  const v = raw.toLowerCase();
  if (!v) return { industry: Industry.OTHER, matched: false };
  if (/law|legal|attorney|litigation|counsel/.test(v)) return { industry: Industry.LEGAL, matched: true };
  if (/med|health|clinic|dent|hospital|pharma|care/.test(v)) return { industry: Industry.MEDICAL, matched: true };
  if (/federal|gov|defense|aerospace|contracting/.test(v)) return { industry: Industry.FEDERAL_CONTRACTING, matched: true };
  if (/manufact|industrial|machin|fabricat/.test(v)) return { industry: Industry.MANUFACTURING, matched: true };
  if (/hotel|hospitality|restaurant|food|leisure/.test(v)) return { industry: Industry.HOSPITALITY, matched: true };
  if (/financ|bank|insur|invest|account|cpa|tax|wealth|capital/.test(v)) return { industry: Industry.FINANCIAL_SERVICES, matched: true };
  if (/consult|profession|service|market|real estate|staffing|architect|engineer/.test(v)) return { industry: Industry.PROFESSIONAL_SERVICES, matched: true };
  if (/school|educat|univer|college|academy/.test(v)) return { industry: Industry.EDUCATION, matched: true };
  if (/nonprofit|non-profit|charity|ngo|church|foundation/.test(v)) return { industry: Industry.NONPROFIT, matched: true };
  return { industry: Industry.OTHER, matched: false };
}

/** Coarse role bucket so LeadTabs can group contacts under a heading. */
function roleFor(title: string): string {
  const t = title.toLowerCase();
  if (/owner|partner|president|principal|founder|ceo|cfo|coo|managing|chief|director|vp|vice president/.test(t)) {
    return "Decision-maker";
  }
  if (/admin|manager|operations|office|bookkeep|controller|coordinator/.test(t)) {
    return "Operations";
  }
  return "Contact";
}

function asUrl(v: string): string | undefined {
  if (!v) return undefined;
  let c = v.trim();
  if (!/^https?:\/\//i.test(c)) c = "https://" + c;
  try {
    new URL(c);
    return c;
  } catch {
    return undefined;
  }
}

function asEmail(v: string): string | undefined {
  const t = v.trim();
  return t && /.+@.+\..+/.test(t) ? t : undefined;
}

function clamp(v: string | undefined, max: number): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Normalize one B2B Rocket row into a Lead-create payload. Only
 * `businessName` is required; everything else is best-effort and degrades to
 * a warning rather than an error so a sparse row still imports.
 */
export function normalizeB2BRocketRow(raw: Record<string, string>): B2BRocketNormalized {
  const get = lookup(raw);
  const errors: string[] = [];
  const warnings: string[] = [];

  const businessName = get("Company Name", "Company", "Business Name");
  if (!businessName) {
    errors.push("Company Name is required");
    return { errors, warnings };
  }

  // --- Industry ---
  const rawIndustry = get("Industry");
  const { industry, matched } = mapIndustry(rawIndustry);
  if (rawIndustry && !matched) {
    warnings.push(`industry "${rawIndustry}" not mapped — set to OTHER (kept as subindustry)`);
  }

  // --- Vendor score ---
  const rawScore = get("Score");
  let vendorLeadScore: number | undefined;
  if (rawScore) {
    const cleaned = rawScore.replace(/[^0-9.]/g, "");
    const n = cleaned ? Math.round(Number(cleaned)) : NaN;
    if (Number.isFinite(n)) vendorLeadScore = n;
    else warnings.push(`Score "${rawScore}" not numeric — dropping`);
  }

  // --- Intent topics (comma-separated) ---
  const intentTopics = get("Intent Topics")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // --- Contacts 1..3 → keyContacts; pull primary email/phone from the
  //     numbered contact whose name matches the Primary Contact. ---
  const primaryName = get("Primary Contact Name");
  const primaryTitle = get("Primary Contact Job Title", "Primary Contact Title");
  const keyContacts: KeyContact[] = [];
  let primaryEmail: string | undefined;
  let primaryPhone: string | undefined;

  for (let i = 1; i <= MAX_CONTACTS; i++) {
    const name = get(`Contact ${i} Name`);
    if (!name) continue;
    const title = get(`Contact ${i} Job Title`, `Contact ${i} Title`);
    const email = asEmail(get(`Contact ${i} Email`));
    const phone = clamp(get(`Contact ${i} Phone Number`, `Contact ${i} Phone`), 50);
    const sourceUrl = asUrl(get(`Contact ${i} Linkedin URL`, `Contact ${i} LinkedIn URL`));
    const location = clamp(get(`Contact ${i} Location`), 120);
    keyContacts.push({
      name,
      title: clamp(title, 200),
      role: roleFor(title),
      email,
      phone,
      sourceUrl,
      location,
      confidence: 1,
    });
    // Promote the matching (or first) contact's email/phone to the primary.
    const isPrimaryMatch = primaryName && name.toLowerCase() === primaryName.toLowerCase();
    if ((isPrimaryMatch || (!primaryEmail && i === 1)) && email) primaryEmail = email;
    if ((isPrimaryMatch || (!primaryPhone && i === 1)) && phone) primaryPhone = phone;
  }

  // --- Research prose ---
  const description = clamp(get("Description"), 5000);
  const reason = clamp(get("Reason"), 1000);
  const researchFitSignals = reason ? [reason] : [];

  const playbookUrl = asUrl(get("Playbook URL"));
  const externalLeadId = clamp(get("ID", "Lead ID", "Record ID"), 100);

  const data: Record<string, unknown> = {
    businessName: clamp(businessName, 300),
    industry,
    subindustry: clamp(rawIndustry, 200),
    // Vendor signals
    externalLeadId,
    vendorLeadScore,
    vendorScoreSource: vendorLeadScore != null ? "B2B Rocket" : undefined,
    intentTopics,
    playbookUrl,
    // Primary contact
    primaryContactName: clamp(primaryName, 200),
    primaryContactTitle: clamp(primaryTitle, 200),
    primaryContactEmail: primaryEmail,
    primaryContactPhone: primaryPhone,
    // Research surface — renders immediately on the lead's Research tab.
    researchSummary: description,
    researchFitSignals,
    keyContacts: keyContacts.length > 0 ? keyContacts : undefined,
    researchCompletedAt: description || keyContacts.length > 0 ? new Date() : undefined,
    enrichmentSource: "b2b_rocket_csv",
  };

  // Drop undefined keys so the create payload only carries real values.
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k];
  }

  return { data, errors, warnings };
}
