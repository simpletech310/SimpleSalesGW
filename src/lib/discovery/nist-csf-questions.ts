import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * NIST CSF 2.0 — full 106 Subcategory assessment.
 *
 * Six Functions × Categories × Subcategories. Each Subcategory is one question.
 * Option weights are tiers 1-4 (Partial → Risk-Informed → Repeatable → Adaptive).
 * Plus an evidence text field per Function and a target tier at the end.
 *
 * Source: NIST Cybersecurity Framework 2.0 (Feb 2024), official Subcategory list.
 */

const tierOptions = [
  { value: "tier_1", label: "Tier 1 — Partial (ad-hoc, reactive)", weight: 1 },
  { value: "tier_2", label: "Tier 2 — Risk-Informed (some process)", weight: 2 },
  { value: "tier_3", label: "Tier 3 — Repeatable (formal, consistent)", weight: 3 },
  { value: "tier_4", label: "Tier 4 — Adaptive (continuous improvement)", weight: 4 },
  { value: "na", label: "Not applicable", weight: 0 },
];

function sub(id: string, section: string, prompt: string, helpText?: string): DiscoveryQuestion {
  return {
    id,
    section,
    prompt,
    helpText,
    type: "single_select",
    required: false,
    options: tierOptions,
  };
}

export const NIST_CSF_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // =========================================================================
  // GOVERN (GV) — 31 Subcategories
  // =========================================================================

  // GV.OC — Organizational Context (5)
  sub("GV.OC-01", "Govern · Organizational Context", "The organizational mission is understood and informs cybersecurity risk management"),
  sub("GV.OC-02", "Govern · Organizational Context", "Internal and external stakeholders are understood, and their needs and expectations regarding cybersecurity risk management are understood and considered"),
  sub("GV.OC-03", "Govern · Organizational Context", "Legal, regulatory, and contractual requirements regarding cybersecurity are understood and managed"),
  sub("GV.OC-04", "Govern · Organizational Context", "Critical objectives, capabilities, and services that external stakeholders depend on or expect from the organization are understood and communicated"),
  sub("GV.OC-05", "Govern · Organizational Context", "Outcomes, capabilities, and services that the organization depends on are understood and communicated"),

  // GV.RM — Risk Management Strategy (7)
  sub("GV.RM-01", "Govern · Risk Management Strategy", "Risk management objectives are established and agreed to by organizational stakeholders"),
  sub("GV.RM-02", "Govern · Risk Management Strategy", "Risk appetite and risk tolerance statements are established, communicated, and maintained"),
  sub("GV.RM-03", "Govern · Risk Management Strategy", "Cybersecurity risk management activities and outcomes are included in enterprise risk management processes"),
  sub("GV.RM-04", "Govern · Risk Management Strategy", "Strategic direction that describes appropriate risk response options is established and communicated"),
  sub("GV.RM-05", "Govern · Risk Management Strategy", "Lines of communication across the organization are established for cybersecurity risks"),
  sub("GV.RM-06", "Govern · Risk Management Strategy", "A standardized method for calculating, documenting, categorizing, and prioritizing cybersecurity risks is established"),
  sub("GV.RM-07", "Govern · Risk Management Strategy", "Strategic opportunities (positive risks) are characterized and included in organizational cybersecurity risk discussions"),

  // GV.RR — Roles, Responsibilities, Authorities (4)
  sub("GV.RR-01", "Govern · Roles, Responsibilities, Authorities", "Organizational leadership is responsible and accountable for cybersecurity risk and fosters a risk-aware, ethical culture"),
  sub("GV.RR-02", "Govern · Roles, Responsibilities, Authorities", "Roles, responsibilities, and authorities related to cybersecurity risk management are established, communicated, understood, and enforced"),
  sub("GV.RR-03", "Govern · Roles, Responsibilities, Authorities", "Adequate resources are allocated commensurate with the cybersecurity risk strategy, roles, responsibilities, and policies"),
  sub("GV.RR-04", "Govern · Roles, Responsibilities, Authorities", "Cybersecurity is included in human resources practices"),

  // GV.PO — Policy (2)
  sub("GV.PO-01", "Govern · Policy", "Policy for managing cybersecurity risks is established based on organizational context, cybersecurity strategy, and priorities and is communicated and enforced"),
  sub("GV.PO-02", "Govern · Policy", "Policy is reviewed, updated, communicated, and enforced to reflect changes in requirements, threats, technology, and organizational mission"),

  // GV.OV — Oversight (3)
  sub("GV.OV-01", "Govern · Oversight", "Cybersecurity risk management strategy outcomes are reviewed to inform and adjust strategy and direction"),
  sub("GV.OV-02", "Govern · Oversight", "The cybersecurity risk management strategy is reviewed and adjusted to ensure coverage of organizational requirements and risks"),
  sub("GV.OV-03", "Govern · Oversight", "Organizational cybersecurity risk management performance is evaluated and reviewed for adjustments needed"),

  // GV.SC — Supply Chain Risk Management (10)
  sub("GV.SC-01", "Govern · Supply Chain Risk", "A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established and agreed to by organizational stakeholders"),
  sub("GV.SC-02", "Govern · Supply Chain Risk", "Cybersecurity roles and responsibilities for suppliers, customers, and partners are established, communicated, and coordinated"),
  sub("GV.SC-03", "Govern · Supply Chain Risk", "Cybersecurity supply chain risk management is integrated into cybersecurity and enterprise risk management, risk assessment, and improvement processes"),
  sub("GV.SC-04", "Govern · Supply Chain Risk", "Suppliers are known and prioritized by criticality"),
  sub("GV.SC-05", "Govern · Supply Chain Risk", "Requirements to address cybersecurity risks in supply chains are established, prioritized, and integrated into contracts and other agreements with suppliers and other third parties"),
  sub("GV.SC-06", "Govern · Supply Chain Risk", "Planning and due diligence are performed to reduce risks before entering into formal supplier or other third-party relationships"),
  sub("GV.SC-07", "Govern · Supply Chain Risk", "The risks posed by a supplier, their products and services, and other third parties are understood, recorded, prioritized, assessed, responded to, and monitored"),
  sub("GV.SC-08", "Govern · Supply Chain Risk", "Relevant suppliers and other third parties are included in incident planning, response, and recovery activities"),
  sub("GV.SC-09", "Govern · Supply Chain Risk", "Supply chain security practices are integrated into cybersecurity and enterprise risk management programs, and their performance is monitored throughout the technology product and service life cycle"),
  sub("GV.SC-10", "Govern · Supply Chain Risk", "Cybersecurity supply chain risk management plans include provisions for activities that occur after the conclusion of a partnership or service agreement"),

  { id: "GV.NOTES", section: "Govern · Evidence", prompt: "Evidence and notes for GOVERN function", type: "text", required: false },

  // =========================================================================
  // IDENTIFY (ID) — 21 Subcategories
  // =========================================================================

  sub("ID.AM-01", "Identify · Asset Management", "Inventories of hardware managed by the organization are maintained"),
  sub("ID.AM-02", "Identify · Asset Management", "Inventories of software, services, and systems managed by the organization are maintained"),
  sub("ID.AM-03", "Identify · Asset Management", "Representations of the organization's authorized network communication and internal and external network data flows are maintained"),
  sub("ID.AM-04", "Identify · Asset Management", "Inventories of services provided by suppliers are maintained"),
  sub("ID.AM-05", "Identify · Asset Management", "Assets are prioritized based on classification, criticality, resources, and impact on the mission"),
  sub("ID.AM-07", "Identify · Asset Management", "Inventories of data and corresponding metadata for designated data types are maintained"),
  sub("ID.AM-08", "Identify · Asset Management", "Systems, hardware, software, services, and data are managed throughout their life cycles"),

  sub("ID.RA-01", "Identify · Risk Assessment", "Vulnerabilities in assets are identified, validated, and recorded"),
  sub("ID.RA-02", "Identify · Risk Assessment", "Cyber threat intelligence is received from information sharing forums and sources"),
  sub("ID.RA-03", "Identify · Risk Assessment", "Internal and external threats to the organization are identified and recorded"),
  sub("ID.RA-04", "Identify · Risk Assessment", "Potential impacts and likelihoods of threats exploiting vulnerabilities are identified and recorded"),
  sub("ID.RA-05", "Identify · Risk Assessment", "Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent risk and inform risk response prioritization"),
  sub("ID.RA-06", "Identify · Risk Assessment", "Risk responses are chosen, prioritized, planned, tracked, and communicated"),
  sub("ID.RA-07", "Identify · Risk Assessment", "Changes and exceptions are managed, assessed for risk impact, recorded, and tracked"),
  sub("ID.RA-08", "Identify · Risk Assessment", "Processes for receiving, analyzing, and responding to vulnerability disclosures are established"),
  sub("ID.RA-09", "Identify · Risk Assessment", "The authenticity and integrity of hardware and software are assessed prior to acquisition and use"),
  sub("ID.RA-10", "Identify · Risk Assessment", "Critical suppliers are assessed prior to acquisition"),

  sub("ID.IM-01", "Identify · Improvement", "Improvements are identified from evaluations"),
  sub("ID.IM-02", "Identify · Improvement", "Improvements are identified from security tests and exercises, including those done in coordination with suppliers and relevant third parties"),
  sub("ID.IM-03", "Identify · Improvement", "Improvements are identified from execution of operational processes, procedures, and activities"),
  sub("ID.IM-04", "Identify · Improvement", "Incident response plans and other cybersecurity plans that affect operations are established, communicated, maintained, and improved"),

  { id: "ID.NOTES", section: "Identify · Evidence", prompt: "Evidence and notes for IDENTIFY function", type: "text", required: false },

  // =========================================================================
  // PROTECT (PR) — 22 Subcategories
  // =========================================================================

  sub("PR.AA-01", "Protect · Identity & Access", "Identities and credentials for authorized users, services, and hardware are managed by the organization"),
  sub("PR.AA-02", "Protect · Identity & Access", "Identities are proofed and bound to credentials based on the context of interactions"),
  sub("PR.AA-03", "Protect · Identity & Access", "Users, services, and hardware are authenticated"),
  sub("PR.AA-04", "Protect · Identity & Access", "Identity assertions are protected, conveyed, and verified"),
  sub("PR.AA-05", "Protect · Identity & Access", "Access permissions, entitlements, and authorizations are defined, managed, enforced, and reviewed, incorporating least privilege and separation of duties"),
  sub("PR.AA-06", "Protect · Identity & Access", "Physical access to assets is managed, monitored, and enforced commensurate with risk"),

  sub("PR.AT-01", "Protect · Awareness & Training", "Personnel are provided with awareness and training so that they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind"),
  sub("PR.AT-02", "Protect · Awareness & Training", "Individuals in specialized roles are provided with awareness and training so that they possess the knowledge and skills to perform relevant tasks with cybersecurity risks in mind"),

  sub("PR.DS-01", "Protect · Data Security", "The confidentiality, integrity, and availability of data-at-rest are protected"),
  sub("PR.DS-02", "Protect · Data Security", "The confidentiality, integrity, and availability of data-in-transit are protected"),
  sub("PR.DS-10", "Protect · Data Security", "The confidentiality, integrity, and availability of data-in-use are protected"),
  sub("PR.DS-11", "Protect · Data Security", "Backups of data are created, protected, maintained, and tested"),

  sub("PR.PS-01", "Protect · Platform Security", "Configuration management practices are established and applied"),
  sub("PR.PS-02", "Protect · Platform Security", "Software is maintained, replaced, and removed commensurate with risk"),
  sub("PR.PS-03", "Protect · Platform Security", "Hardware is maintained, replaced, and removed commensurate with risk"),
  sub("PR.PS-04", "Protect · Platform Security", "Log records are generated and made available for continuous monitoring"),
  sub("PR.PS-05", "Protect · Platform Security", "Installation and execution of unauthorized software are prevented"),
  sub("PR.PS-06", "Protect · Platform Security", "Secure software development practices are integrated and monitored throughout the software development life cycle"),

  sub("PR.IR-01", "Protect · Tech Resilience", "Networks and environments are protected from unauthorized logical access and usage"),
  sub("PR.IR-02", "Protect · Tech Resilience", "The organization's technology assets are protected from environmental threats"),
  sub("PR.IR-03", "Protect · Tech Resilience", "Mechanisms (e.g., failsafe, load balancing, hot swap) are implemented to achieve resilience requirements in normal and adverse situations"),
  sub("PR.IR-04", "Protect · Tech Resilience", "Adequate resource capacity to ensure availability is maintained"),

  { id: "PR.NOTES", section: "Protect · Evidence", prompt: "Evidence and notes for PROTECT function", type: "text", required: false },

  // =========================================================================
  // DETECT (DE) — 11 Subcategories
  // =========================================================================

  sub("DE.CM-01", "Detect · Continuous Monitoring", "Networks and network services are monitored to find potentially adverse events"),
  sub("DE.CM-02", "Detect · Continuous Monitoring", "The physical environment is monitored to find potentially adverse events"),
  sub("DE.CM-03", "Detect · Continuous Monitoring", "Personnel activity and technology usage are monitored to find potentially adverse events"),
  sub("DE.CM-06", "Detect · Continuous Monitoring", "External service provider activities and services are monitored to find potentially adverse events"),
  sub("DE.CM-09", "Detect · Continuous Monitoring", "Computing hardware and software, runtime environments, and their data are monitored to find potentially adverse events"),
  sub("DE.CM-11", "Detect · Continuous Monitoring", "Unauthorized resource use, including authentication anomalies, is monitored"),

  sub("DE.AE-02", "Detect · Adverse Event Analysis", "Potentially adverse events are analyzed to better understand associated activities"),
  sub("DE.AE-03", "Detect · Adverse Event Analysis", "Information is correlated from multiple sources"),
  sub("DE.AE-04", "Detect · Adverse Event Analysis", "The estimated impact and scope of adverse events are understood"),
  sub("DE.AE-06", "Detect · Adverse Event Analysis", "Information on adverse events is provided to authorized staff and tools"),
  sub("DE.AE-07", "Detect · Adverse Event Analysis", "Cyber threat intelligence and other contextual information are integrated into the analysis"),

  { id: "DE.NOTES", section: "Detect · Evidence", prompt: "Evidence and notes for DETECT function", type: "text", required: false },

  // =========================================================================
  // RESPOND (RS) — 13 Subcategories
  // =========================================================================

  sub("RS.MA-01", "Respond · Incident Management", "The incident response plan is executed in coordination with relevant third parties once an incident is declared"),
  sub("RS.MA-02", "Respond · Incident Management", "Incident reports are triaged and validated"),
  sub("RS.MA-03", "Respond · Incident Management", "Incidents are categorized and prioritized"),
  sub("RS.MA-04", "Respond · Incident Management", "Incidents are escalated or elevated as needed"),
  sub("RS.MA-05", "Respond · Incident Management", "The criteria for initiating incident recovery are applied"),

  sub("RS.AN-03", "Respond · Incident Analysis", "Analysis is performed to establish what has taken place during an incident and the root cause of the incident"),
  sub("RS.AN-06", "Respond · Incident Analysis", "Actions performed during an investigation are recorded, and the records' integrity and provenance are preserved"),
  sub("RS.AN-07", "Respond · Incident Analysis", "Incident data and metadata are collected, and their integrity and provenance are preserved"),
  sub("RS.AN-08", "Respond · Incident Analysis", "An incident's magnitude is estimated and validated"),

  sub("RS.CO-02", "Respond · Response Communication", "Internal and external stakeholders are notified of incidents"),
  sub("RS.CO-03", "Respond · Response Communication", "Information is shared with designated internal and external stakeholders"),

  sub("RS.MI-01", "Respond · Incident Mitigation", "Incidents are contained"),
  sub("RS.MI-02", "Respond · Incident Mitigation", "Incidents are eradicated"),

  { id: "RS.NOTES", section: "Respond · Evidence", prompt: "Evidence and notes for RESPOND function", type: "text", required: false },

  // =========================================================================
  // RECOVER (RC) — 8 Subcategories
  // =========================================================================

  sub("RC.RP-01", "Recover · Recovery Plan Execution", "The recovery portion of the incident response plan is executed once initiated from the incident response process"),
  sub("RC.RP-02", "Recover · Recovery Plan Execution", "Recovery actions are selected, scoped, prioritized, and performed"),
  sub("RC.RP-03", "Recover · Recovery Plan Execution", "The integrity of backups and other restoration assets is verified before using them for restoration"),
  sub("RC.RP-04", "Recover · Recovery Plan Execution", "Critical mission functions and cybersecurity risk management are considered to establish post-incident operational norms"),
  sub("RC.RP-05", "Recover · Recovery Plan Execution", "The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed"),

  sub("RC.CO-03", "Recover · Recovery Communication", "Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders"),
  sub("RC.CO-04", "Recover · Recovery Communication", "Public updates on incident recovery are shared using approved methods and messaging"),
  sub("RC.IM-01", "Recover · Improvement", "Lessons learned from incident recovery are documented and used to improve recovery plans and other cybersecurity activities"),

  { id: "RC.NOTES", section: "Recover · Evidence", prompt: "Evidence and notes for RECOVER function", type: "text", required: false },

  // =========================================================================
  // Target tier
  // =========================================================================

  {
    id: "TG01",
    section: "Target",
    prompt: "Target tier the customer wants to reach across all Functions",
    type: "single_select",
    required: true,
    options: tierOptions.filter((o) => o.value !== "na"),
  },
];

export const NIST_CSF_BANK: DiscoveryBank = {
  kind: "NIST_CSF",
  questions: NIST_CSF_QUESTIONS,
};

export const NIST_CSF_FUNCTIONS = ["Govern", "Identify", "Protect", "Detect", "Respond", "Recover"] as const;

/** Extract the Function name (first segment of `section`) for grouping/rollup. */
export function functionOf(q: DiscoveryQuestion): string {
  return q.section.split("·")[0]!.trim();
}
