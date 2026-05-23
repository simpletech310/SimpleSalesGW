import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * MSP Site Survey — structured data capture for the technical baseline.
 * Mirrors 01-MSP-Site-Survey/MSP_Site_Survey_TEMPLATE.md.
 * No numeric score — produces a Findings + Risks summary.
 */

export const SITE_SURVEY_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Sites & Connectivity
  { id: "SS01", section: "Sites & Connectivity", prompt: "How many physical locations?", type: "numeric", required: true },
  { id: "SS02", section: "Sites & Connectivity", prompt: "Primary internet provider(s) and speeds", type: "text", required: true },
  { id: "SS03", section: "Sites & Connectivity", prompt: "Is there a failover/redundant WAN link?", type: "boolean", required: true },
  { id: "SS04", section: "Sites & Connectivity", prompt: "Do sites connect via VPN/SD-WAN?", type: "single_select", required: true, options: [
    { value: "site_to_site_vpn", label: "Site-to-site VPN" },
    { value: "sd_wan", label: "SD-WAN" },
    { value: "mpls", label: "MPLS" },
    { value: "none", label: "None — independent" },
    { value: "single_site", label: "Single site" },
  ] },
  { id: "SS05", section: "Sites & Connectivity", prompt: "Approximate end-user count across all sites", type: "numeric", required: true },

  // Identity & Endpoints
  { id: "SS06", section: "Identity & Endpoints", prompt: "Primary identity provider", type: "single_select", required: true, options: [
    { value: "entra_azuread", label: "Microsoft Entra / Azure AD" },
    { value: "google_workspace", label: "Google Workspace" },
    { value: "okta", label: "Okta" },
    { value: "on_prem_ad", label: "On-prem Active Directory" },
    { value: "hybrid", label: "Hybrid" },
    { value: "other", label: "Other / unsure" },
  ] },
  { id: "SS07", section: "Identity & Endpoints", prompt: "MFA coverage", type: "single_select", required: true, options: [
    { value: "all", label: "All users" },
    { value: "admins_only", label: "Admins only" },
    { value: "most", label: "Most users" },
    { value: "few", label: "Few users" },
    { value: "none", label: "None" },
  ] },
  { id: "SS08", section: "Identity & Endpoints", prompt: "Endpoint count (workstations + servers)", type: "numeric", required: true },
  { id: "SS09", section: "Identity & Endpoints", prompt: "Endpoint management / RMM in place?", type: "single_select", required: true, options: [
    { value: "yes_managed", label: "Yes — actively managed" },
    { value: "yes_unmanaged", label: "Yes — installed but unmanaged" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Unsure" },
  ] },
  { id: "SS10", section: "Identity & Endpoints", prompt: "AV / EDR product", type: "text", required: false },

  // Apps & Data
  { id: "SS11", section: "Apps & Data", prompt: "Primary email/collab platform", type: "single_select", required: true, options: [
    { value: "m365", label: "Microsoft 365" },
    { value: "google_workspace", label: "Google Workspace" },
    { value: "other", label: "Other" },
  ] },
  { id: "SS12", section: "Apps & Data", prompt: "File storage primary", type: "multi_select", required: true, options: [
    { value: "onedrive_sharepoint", label: "OneDrive / SharePoint" },
    { value: "google_drive", label: "Google Drive" },
    { value: "on_prem_fileserver", label: "On-prem fileserver" },
    { value: "nas", label: "NAS" },
    { value: "dropbox_box", label: "Dropbox / Box" },
    { value: "other", label: "Other" },
  ] },
  { id: "SS13", section: "Apps & Data", prompt: "Line-of-business / vertical applications", type: "text", required: false, helpText: "Practice management, ERP, scheduling, POS, etc." },
  { id: "SS14", section: "Apps & Data", prompt: "Any SaaS apps with admin-only access concerns?", type: "boolean_with_text", required: false },

  // Backups & DR
  { id: "SS15", section: "Backups & DR", prompt: "Backup solution", type: "text", required: true },
  { id: "SS16", section: "Backups & DR", prompt: "Last successful restore test", type: "single_select", required: true, options: [
    { value: "lt_30", label: "Within 30 days" },
    { value: "lt_90", label: "Within 90 days" },
    { value: "lt_365", label: "Within a year" },
    { value: "never", label: "Never tested" },
    { value: "unsure", label: "Unsure" },
  ] },
  { id: "SS17", section: "Backups & DR", prompt: "RPO target (acceptable data loss)", type: "text", required: false },
  { id: "SS18", section: "Backups & DR", prompt: "RTO target (time to be back online)", type: "text", required: false },

  // Security Stack
  { id: "SS19", section: "Security Stack", prompt: "Firewall vendor + model(s)", type: "text", required: true },
  { id: "SS20", section: "Security Stack", prompt: "DNS filtering / web filter in place?", type: "boolean", required: true },
  { id: "SS21", section: "Security Stack", prompt: "Email security (beyond default)?", type: "text", required: false, helpText: "Mimecast, Proofpoint, M365 Defender, etc." },
  { id: "SS22", section: "Security Stack", prompt: "SIEM / log aggregation?", type: "single_select", required: true, options: [
    { value: "yes", label: "Yes — actively monitored" },
    { value: "yes_unmonitored", label: "Yes — collected, not monitored" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Unsure" },
  ] },
  { id: "SS23", section: "Security Stack", prompt: "Documented incident response plan?", type: "single_select", required: true, options: [
    { value: "documented_tested", label: "Documented and tested" },
    { value: "documented", label: "Documented only" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Unsure" },
  ] },

  // Compliance Obligations
  { id: "SS24", section: "Compliance Obligations", prompt: "Active regulations", type: "multi_select", required: true, options: [
    { value: "HIPAA", label: "HIPAA" },
    { value: "PCI", label: "PCI-DSS" },
    { value: "CMMC", label: "CMMC / NIST 800-171" },
    { value: "GLBA", label: "GLBA" },
    { value: "FTC_SAFEGUARDS", label: "FTC Safeguards" },
    { value: "SEC", label: "SEC cyber" },
    { value: "FERPA", label: "FERPA" },
    { value: "STATE_PRIVACY", label: "State privacy law" },
    { value: "NONE", label: "None" },
  ] },
  { id: "SS25", section: "Compliance Obligations", prompt: "Cyber insurance renewal date", type: "date", required: false },
  { id: "SS26", section: "Compliance Obligations", prompt: "Most recent third-party security questionnaire / audit", type: "text", required: false },

  // Stakeholders
  { id: "SS27", section: "Stakeholders", prompt: "Primary IT decision-maker (name + title)", type: "text", required: true },
  { id: "SS28", section: "Stakeholders", prompt: "Executive sponsor (name + title)", type: "text", required: true },
  { id: "SS29", section: "Stakeholders", prompt: "Other key stakeholders (departments, vendors)", type: "text", required: false },
  { id: "SS30", section: "Stakeholders", prompt: "Anything else the survey missed?", type: "text", required: false },
];

export const SITE_SURVEY_BANK: DiscoveryBank = {
  kind: "SITE_SURVEY",
  questions: SITE_SURVEY_QUESTIONS,
};
