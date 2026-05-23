/**
 * 25-question Basic IT Assessment — question bank.
 * Stable IDs (Q01..Q25). Order = display order.
 * Section letters per Section 8 of the PRD.
 */

import { Industry, ComplianceDriver } from "@prisma/client";

export type QuestionType =
  | "single_select"
  | "multi_select"
  | "boolean"
  | "boolean_with_date"
  | "boolean_with_text"
  | "numeric"
  | "date"
  | "text";

export type QuestionOption = {
  value: string;
  label: string;
};

export type Question = {
  id: string;
  section: "A" | "B" | "C" | "D" | "E";
  type: QuestionType;
  prompt: string;
  helpText?: string;
  options?: ReadonlyArray<QuestionOption>;
  required: boolean;
};

export const QUESTIONS: ReadonlyArray<Question> = [
  // ---------- Section A — Business basics
  {
    id: "Q01",
    section: "A",
    type: "single_select",
    prompt: "What industry best describes your business?",
    required: true,
    options: [
      { value: "MEDICAL", label: "Medical / Healthcare" },
      { value: "LEGAL", label: "Legal" },
      { value: "FEDERAL_CONTRACTING", label: "Federal Contracting" },
      { value: "MANUFACTURING", label: "Manufacturing" },
      { value: "HOSPITALITY", label: "Hospitality" },
      { value: "FINANCIAL_SERVICES", label: "Financial Services" },
      { value: "PROFESSIONAL_SERVICES", label: "Professional Services" },
      { value: "EDUCATION", label: "Education" },
      { value: "NONPROFIT", label: "Nonprofit" },
      { value: "OTHER", label: "Other" },
    ],
  },
  {
    id: "Q02",
    section: "A",
    type: "numeric",
    prompt: "How many employees do you have?",
    required: true,
  },
  {
    id: "Q03",
    section: "A",
    type: "numeric",
    prompt: "How many locations do you operate from?",
    required: true,
  },
  {
    id: "Q04",
    section: "A",
    type: "single_select",
    prompt: "What is your approximate annual revenue?",
    required: true,
    options: [
      { value: "lt_1m", label: "Less than $1M" },
      { value: "1_5m", label: "$1M – $5M" },
      { value: "5_25m", label: "$5M – $25M" },
      { value: "25_100m", label: "$25M – $100M" },
      { value: "gt_100m", label: "$100M+" },
      { value: "prefer_not", label: "Prefer not to say" },
    ],
  },
  {
    id: "Q05",
    section: "A",
    type: "multi_select",
    prompt: "What's your 12-month outlook? (select all that apply)",
    required: true,
    options: [
      { value: "hiring", label: "Hiring" },
      { value: "new_location", label: "Opening a new location" },
      { value: "ma", label: "Mergers / acquisitions" },
      { value: "stable", label: "Stable" },
      { value: "contracting", label: "Contracting" },
    ],
  },
  // ---------- Section B — Current technology
  {
    id: "Q06",
    section: "B",
    type: "single_select",
    prompt: "Who handles your IT today?",
    required: true,
    options: [
      { value: "in_house_team", label: "In-house team" },
      { value: "single_in_house", label: "Single in-house person" },
      { value: "current_msp", label: "Current MSP" },
      { value: "office_manager", label: "Office manager / informal" },
      { value: "nobody", label: "Nobody" },
    ],
  },
  {
    id: "Q07",
    section: "B",
    type: "single_select",
    prompt: "What email + collaboration platform do you use?",
    required: true,
    options: [
      { value: "m365", label: "Microsoft 365" },
      { value: "gws", label: "Google Workspace" },
      { value: "other", label: "Other" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  {
    id: "Q08",
    section: "B",
    type: "single_select",
    prompt: "What phone system do you use?",
    required: true,
    options: [
      { value: "hosted_voip", label: "Hosted VoIP" },
      { value: "on_prem_pbx", label: "On-prem PBX" },
      { value: "cell_only", label: "Cell phones only" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "Q09",
    section: "B",
    type: "multi_select",
    prompt: "How do you store files? (select all that apply)",
    required: true,
    options: [
      { value: "on_prem_fileserver", label: "On-prem fileserver" },
      { value: "onedrive_sharepoint", label: "OneDrive / SharePoint" },
      { value: "google_drive", label: "Google Drive" },
      { value: "dropbox_box", label: "Dropbox / Box" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "Q10",
    section: "B",
    type: "single_select",
    prompt: "Are you using AI tools at work?",
    required: true,
    options: [
      { value: "yes_officially", label: "Yes — officially" },
      { value: "yes_informally", label: "Yes — informally" },
      { value: "no", label: "No" },
      { value: "interested", label: "Interested but not yet" },
    ],
  },
  {
    id: "Q11",
    section: "B",
    type: "boolean_with_text",
    prompt: "Have you had a major IT outage in the last 12 months?",
    helpText: "If yes, please describe briefly.",
    required: true,
  },
  // ---------- Section C — Security + Compliance
  {
    id: "Q12",
    section: "C",
    type: "boolean_with_date",
    prompt: "Do you carry cyber insurance? If yes, when does it renew?",
    required: true,
  },
  {
    id: "Q13",
    section: "C",
    type: "multi_select",
    prompt: "Which regulations apply to your business? (select all that apply)",
    required: true,
    options: [
      { value: "HIPAA", label: "HIPAA" },
      { value: "PCI", label: "PCI" },
      { value: "CMMC", label: "CMMC / NIST 800-171" },
      { value: "GLBA", label: "GLBA" },
      { value: "FTC_SAFEGUARDS", label: "FTC Safeguards" },
      { value: "SEC", label: "SEC cyber" },
      { value: "FERPA", label: "FERPA" },
      { value: "STATE_PRIVACY", label: "State privacy law" },
      { value: "NONE", label: "None" },
    ],
  },
  {
    id: "Q14",
    section: "C",
    type: "boolean_with_text",
    prompt: "Have you received a cybersecurity questionnaire in the last 12 months?",
    helpText: "If yes, from whom and what was the context?",
    required: true,
  },
  {
    id: "Q15",
    section: "C",
    type: "single_select",
    prompt: "What is your MFA coverage?",
    required: true,
    options: [
      { value: "yes_all", label: "Yes — all users" },
      { value: "most", label: "Most users" },
      { value: "few", label: "Few users" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  {
    id: "Q16",
    section: "C",
    type: "single_select",
    prompt: "Do you have an incident response plan?",
    required: true,
    options: [
      { value: "documented_tested", label: "Documented and tested" },
      { value: "documented", label: "Documented" },
      { value: "no", label: "No" },
      { value: "unsure", label: "Unsure" },
    ],
  },
  // ---------- Section D — Pain + opportunity
  {
    id: "Q17",
    section: "D",
    type: "text",
    prompt: "What is the most painful tech issue you're facing right now?",
    required: true,
  },
  {
    id: "Q18",
    section: "D",
    type: "text",
    prompt: "If you could fix ONE tech thing tomorrow, what would it be?",
    required: true,
  },
  {
    id: "Q19",
    section: "D",
    type: "single_select",
    prompt: "What's your timeline for making a change?",
    required: true,
    options: [
      { value: "immediate", label: "Immediate" },
      { value: "30_days", label: "Within 30 days" },
      { value: "90_days", label: "Within 90 days" },
      { value: "this_year", label: "This year" },
      { value: "no_urgency", label: "No urgency" },
    ],
  },
  {
    id: "Q20",
    section: "D",
    type: "single_select",
    prompt: "What is your budget posture?",
    required: true,
    options: [
      { value: "approved", label: "Approved" },
      { value: "being_planned", label: "Being planned" },
      { value: "need_to_make_case", label: "Need to make a case" },
      { value: "no_signal", label: "No signal" },
    ],
  },
  {
    id: "Q21",
    section: "D",
    type: "text",
    prompt: "Who would need to approve a partnership with Gateway?",
    required: true,
  },
  // ---------- Section E — Strategic + closing
  {
    id: "Q22",
    section: "E",
    type: "boolean_with_text",
    prompt: "Are you planning a new office, move, or build-out in the next 12 months?",
    helpText: "If yes, what's the scope and timing?",
    required: true,
  },
  {
    id: "Q23",
    section: "E",
    type: "boolean",
    prompt: "Are you pursuing federal contracts?",
    required: true,
  },
  {
    id: "Q24",
    section: "E",
    type: "text",
    prompt: "Are any AI initiatives currently stalled? (leave blank if none)",
    required: false,
  },
  {
    id: "Q25",
    section: "E",
    type: "text",
    prompt: "Anything else you'd like Gateway to know?",
    required: false,
  },
];

export function getQuestionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

/** Map Q01 answer value to Prisma Industry enum. */
export function industryFromAnswer(value: string | undefined): Industry {
  if (!value) return Industry.OTHER;
  if ((Object.values(Industry) as string[]).includes(value)) return value as Industry;
  return Industry.OTHER;
}

/** Map Q13 multi-select values to Prisma ComplianceDriver enum array. */
export function complianceDriversFromAnswer(values: ReadonlyArray<string> | undefined): ComplianceDriver[] {
  if (!values || values.length === 0) return [ComplianceDriver.NONE];
  const out = new Set<ComplianceDriver>();
  for (const v of values) {
    switch (v) {
      case "HIPAA": out.add(ComplianceDriver.HIPAA); break;
      case "PCI": out.add(ComplianceDriver.PCI); break;
      case "CMMC": out.add(ComplianceDriver.CMMC); break;
      case "FERPA": out.add(ComplianceDriver.FERPA); break;
      case "GLBA": out.add(ComplianceDriver.GLBA); break;
      case "SEC": out.add(ComplianceDriver.SEC); break;
      case "FTC_SAFEGUARDS":
      case "STATE_PRIVACY":
        out.add(ComplianceDriver.OTHER); break;
      case "NONE": out.add(ComplianceDriver.NONE); break;
      default: out.add(ComplianceDriver.OTHER); break;
    }
  }
  return Array.from(out);
}
