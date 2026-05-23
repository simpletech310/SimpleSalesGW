import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * AI Readiness Questionnaire — 4-pillar maturity (0-4) plus use-case catalog.
 * Mirrors 02-AI-Readiness-Questionnaire/AI_Readiness_Questionnaire_TEMPLATE.md.
 * Per-section maturity score is the average of the section's questions
 * (each option's `weight` is 0-4).
 */

export const AI_READINESS_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // Pillar 1 — Org Readiness
  { id: "AI01", section: "Org Readiness", prompt: "Executive sponsorship for AI initiatives", type: "single_select", required: true, options: [
    { value: "champion", label: "Active CEO/COO champion", weight: 4 },
    { value: "interested", label: "Interested exec but not driving", weight: 3 },
    { value: "siloed", label: "One department experimenting", weight: 2 },
    { value: "skeptical", label: "Skeptical / cautious", weight: 1 },
    { value: "none", label: "No sponsorship", weight: 0 },
  ] },
  { id: "AI02", section: "Org Readiness", prompt: "Budget set aside for AI", type: "single_select", required: true, options: [
    { value: "dedicated", label: "Dedicated AI budget line", weight: 4 },
    { value: "innovation", label: "Innovation/discretionary funds", weight: 3 },
    { value: "case_by_case", label: "Case by case", weight: 2 },
    { value: "limited", label: "Very limited", weight: 1 },
    { value: "none", label: "None", weight: 0 },
  ] },
  { id: "AI03", section: "Org Readiness", prompt: "Change-management maturity", type: "single_select", required: true, options: [
    { value: "strong", label: "Strong — past tech rollouts went well", weight: 4 },
    { value: "ok", label: "OK — some friction expected", weight: 3 },
    { value: "weak", label: "Weak — change is hard here", weight: 1 },
  ] },
  { id: "AI04", section: "Org Readiness", prompt: "Workforce attitude toward AI", type: "single_select", required: true, options: [
    { value: "eager", label: "Eager — already experimenting", weight: 4 },
    { value: "curious", label: "Curious — open to learning", weight: 3 },
    { value: "mixed", label: "Mixed — depends on dept", weight: 2 },
    { value: "anxious", label: "Anxious — fears of job loss", weight: 1 },
    { value: "resistant", label: "Resistant", weight: 0 },
  ] },

  // Pillar 2 — Data Foundations
  { id: "AI05", section: "Data Foundations", prompt: "Data is centralized vs. siloed", type: "single_select", required: true, options: [
    { value: "centralized", label: "Single platform / well-integrated", weight: 4 },
    { value: "mostly", label: "Mostly centralized with some silos", weight: 3 },
    { value: "mixed", label: "Mixed", weight: 2 },
    { value: "siloed", label: "Heavily siloed across tools", weight: 1 },
    { value: "spreadsheets", label: "Mostly spreadsheets / email", weight: 0 },
  ] },
  { id: "AI06", section: "Data Foundations", prompt: "Data hygiene / quality", type: "single_select", required: true, options: [
    { value: "high", label: "High — clean, deduplicated, current", weight: 4 },
    { value: "medium", label: "Medium — known issues", weight: 2 },
    { value: "low", label: "Low — needs cleanup before AI use", weight: 0 },
  ] },
  { id: "AI07", section: "Data Foundations", prompt: "Sensitive data classification in place?", type: "single_select", required: true, options: [
    { value: "labeled", label: "Yes — classification labels enforced", weight: 4 },
    { value: "policy_only", label: "Policy exists, not enforced", weight: 2 },
    { value: "no", label: "No", weight: 0 },
  ] },
  { id: "AI08", section: "Data Foundations", prompt: "Document store usable as RAG source", type: "boolean", required: true, helpText: "SharePoint, Google Drive, etc. with clear permissions" },

  // Pillar 3 — Use Cases
  { id: "AI09", section: "Use Cases", prompt: "Departments most ready to pilot AI (multi-select)", type: "multi_select", required: true, options: [
    { value: "sales", label: "Sales / BD" },
    { value: "marketing", label: "Marketing" },
    { value: "ops", label: "Operations" },
    { value: "finance", label: "Finance / accounting" },
    { value: "hr", label: "HR / people" },
    { value: "legal", label: "Legal / compliance" },
    { value: "engineering", label: "Engineering / R&D" },
    { value: "support", label: "Customer support" },
    { value: "exec", label: "Executive / strategy" },
  ] },
  { id: "AI10", section: "Use Cases", prompt: "Highest-value process to automate today", type: "text", required: true },
  { id: "AI11", section: "Use Cases", prompt: "Stalled AI initiatives (if any)", type: "text", required: false },
  { id: "AI12", section: "Use Cases", prompt: "Tools currently in use", type: "multi_select", required: true, options: [
    { value: "copilot", label: "Microsoft 365 Copilot" },
    { value: "gemini", label: "Google Gemini / Workspace AI" },
    { value: "chatgpt", label: "ChatGPT (consumer or team)" },
    { value: "claude", label: "Anthropic Claude" },
    { value: "custom", label: "Custom / in-house" },
    { value: "none", label: "None officially" },
  ] },

  // Pillar 4 — Governance
  { id: "AI13", section: "Governance", prompt: "AI acceptable-use policy", type: "single_select", required: true, options: [
    { value: "published", label: "Published + trained", weight: 4 },
    { value: "draft", label: "Draft exists", weight: 2 },
    { value: "no", label: "None", weight: 0 },
  ] },
  { id: "AI14", section: "Governance", prompt: "Data residency / vendor approval process for AI tools", type: "single_select", required: true, options: [
    { value: "formal", label: "Formal vendor review", weight: 4 },
    { value: "informal", label: "Informal sign-off", weight: 2 },
    { value: "none", label: "None — anyone can sign up", weight: 0 },
  ] },
  { id: "AI15", section: "Governance", prompt: "Outputs reviewed for accuracy before use?", type: "single_select", required: true, options: [
    { value: "always", label: "Always — human in the loop", weight: 4 },
    { value: "sometimes", label: "Sometimes / depends on use case", weight: 2 },
    { value: "rarely", label: "Rarely", weight: 0 },
  ] },
  { id: "AI16", section: "Governance", prompt: "Audit logging on AI prompts/outputs?", type: "boolean", required: false },
];

export const AI_READINESS_BANK: DiscoveryBank = {
  kind: "AI_READINESS",
  questions: AI_READINESS_QUESTIONS,
};
