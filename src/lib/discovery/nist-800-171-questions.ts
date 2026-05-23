import type { DiscoveryBank, DiscoveryQuestion } from "./types";

/**
 * NIST SP 800-171 Rev 2 — 110 security requirements grouped by 14 families.
 * Used for CMMC Level 2 / federal contractor readiness.
 *
 * Each control captures: implementation status (Implemented / Partially /
 * Planned / Not Applicable / Not Implemented), evidence text, milestone date.
 * Per the 800-171A handbook, scoring starts at 110 and subtracts per-control
 * deductions when not Implemented. See `scoring/nist-800-171.ts`.
 */

const statusOptions = [
  { value: "implemented", label: "Implemented", weight: 1 },
  { value: "partially", label: "Partially implemented", weight: 0.5 },
  { value: "planned", label: "Planned (POAM)", weight: 0 },
  { value: "na", label: "Not applicable", weight: -1 }, // sentinel: excluded from scoring
  { value: "not_implemented", label: "Not implemented", weight: 0 },
];

function ctrl(id: string, family: string, statement: string, deduction = 1): DiscoveryQuestion {
  return {
    id,
    section: family,
    prompt: statement,
    helpText: `Deduction if not fully implemented: ${deduction}`,
    type: "single_select",
    required: false,
    options: statusOptions,
  };
}

/**
 * Per-control deduction value per NIST 800-171A. Most are 1, a small set are 3
 * or 5. We keep the map next to the questions so scoring stays single-source.
 */
export const SP800_171_DEDUCTIONS: Record<string, number> = {
  // 3.1 Access Control
  "3.1.1": 5, "3.1.2": 5, "3.1.3": 1, "3.1.4": 1, "3.1.5": 3,
  "3.1.6": 1, "3.1.7": 1, "3.1.8": 1, "3.1.9": 1, "3.1.10": 1,
  "3.1.11": 1, "3.1.12": 5, "3.1.13": 5, "3.1.14": 1, "3.1.15": 1,
  "3.1.16": 5, "3.1.17": 5, "3.1.18": 5, "3.1.19": 5, "3.1.20": 1,
  "3.1.21": 1, "3.1.22": 1,
  // 3.2 Awareness and Training
  "3.2.1": 3, "3.2.2": 3, "3.2.3": 1,
  // 3.3 Audit and Accountability
  "3.3.1": 5, "3.3.2": 3, "3.3.3": 1, "3.3.4": 1, "3.3.5": 5,
  "3.3.6": 1, "3.3.7": 1, "3.3.8": 1, "3.3.9": 1,
  // 3.4 Configuration Management
  "3.4.1": 5, "3.4.2": 5, "3.4.3": 1, "3.4.4": 1, "3.4.5": 1,
  "3.4.6": 5, "3.4.7": 5, "3.4.8": 5, "3.4.9": 1,
  // 3.5 Identification and Authentication
  "3.5.1": 5, "3.5.2": 5, "3.5.3": 5, "3.5.4": 1, "3.5.5": 1,
  "3.5.6": 1, "3.5.7": 5, "3.5.8": 1, "3.5.9": 1, "3.5.10": 5,
  "3.5.11": 1,
  // 3.6 Incident Response
  "3.6.1": 5, "3.6.2": 5, "3.6.3": 1,
  // 3.7 Maintenance
  "3.7.1": 1, "3.7.2": 1, "3.7.3": 1, "3.7.4": 3, "3.7.5": 5,
  "3.7.6": 1,
  // 3.8 Media Protection
  "3.8.1": 1, "3.8.2": 1, "3.8.3": 1, "3.8.4": 1, "3.8.5": 1,
  "3.8.6": 1, "3.8.7": 5, "3.8.8": 5, "3.8.9": 1,
  // 3.9 Personnel Security
  "3.9.1": 1, "3.9.2": 1,
  // 3.10 Physical Protection
  "3.10.1": 5, "3.10.2": 5, "3.10.3": 1, "3.10.4": 1, "3.10.5": 1,
  "3.10.6": 1,
  // 3.11 Risk Assessment
  "3.11.1": 3, "3.11.2": 5, "3.11.3": 1,
  // 3.12 Security Assessment
  "3.12.1": 5, "3.12.2": 3, "3.12.3": 5, "3.12.4": 1,
  // 3.13 System and Communications Protection
  "3.13.1": 5, "3.13.2": 5, "3.13.3": 1, "3.13.4": 1, "3.13.5": 5,
  "3.13.6": 5, "3.13.7": 1, "3.13.8": 5, "3.13.9": 1, "3.13.10": 5,
  "3.13.11": 5, "3.13.12": 1, "3.13.13": 1, "3.13.14": 5, "3.13.15": 5,
  "3.13.16": 1,
  // 3.14 System and Information Integrity
  "3.14.1": 5, "3.14.2": 5, "3.14.3": 5, "3.14.4": 5, "3.14.5": 3,
  "3.14.6": 5, "3.14.7": 3,
};

export const NIST_800_171_QUESTIONS: ReadonlyArray<DiscoveryQuestion> = [
  // 3.1 Access Control (22)
  ctrl("3.1.1", "3.1 Access Control", "Limit system access to authorized users, processes acting on behalf of authorized users, and devices (including other systems).", 5),
  ctrl("3.1.2", "3.1 Access Control", "Limit system access to the types of transactions and functions that authorized users are permitted to execute.", 5),
  ctrl("3.1.3", "3.1 Access Control", "Control the flow of CUI in accordance with approved authorizations.", 1),
  ctrl("3.1.4", "3.1 Access Control", "Separate the duties of individuals to reduce the risk of malevolent activity without collusion.", 1),
  ctrl("3.1.5", "3.1 Access Control", "Employ the principle of least privilege, including for specific security functions and privileged accounts.", 3),
  ctrl("3.1.6", "3.1 Access Control", "Use non-privileged accounts or roles when accessing nonsecurity functions.", 1),
  ctrl("3.1.7", "3.1 Access Control", "Prevent non-privileged users from executing privileged functions and capture the execution of such functions in audit logs.", 1),
  ctrl("3.1.8", "3.1 Access Control", "Limit unsuccessful logon attempts.", 1),
  ctrl("3.1.9", "3.1 Access Control", "Provide privacy and security notices consistent with applicable CUI rules.", 1),
  ctrl("3.1.10", "3.1 Access Control", "Use session lock with pattern-hiding displays to prevent access and viewing of data after a period of inactivity.", 1),
  ctrl("3.1.11", "3.1 Access Control", "Terminate (automatically) a user session after a defined condition.", 1),
  ctrl("3.1.12", "3.1 Access Control", "Monitor and control remote access sessions.", 5),
  ctrl("3.1.13", "3.1 Access Control", "Employ cryptographic mechanisms to protect the confidentiality of remote access sessions.", 5),
  ctrl("3.1.14", "3.1 Access Control", "Route remote access via managed access control points.", 1),
  ctrl("3.1.15", "3.1 Access Control", "Authorize remote execution of privileged commands and remote access to security-relevant information.", 1),
  ctrl("3.1.16", "3.1 Access Control", "Authorize wireless access prior to allowing such connections.", 5),
  ctrl("3.1.17", "3.1 Access Control", "Protect wireless access using authentication and encryption.", 5),
  ctrl("3.1.18", "3.1 Access Control", "Control connection of mobile devices.", 5),
  ctrl("3.1.19", "3.1 Access Control", "Encrypt CUI on mobile devices and mobile computing platforms.", 5),
  ctrl("3.1.20", "3.1 Access Control", "Verify and control/limit connections to and use of external systems.", 1),
  ctrl("3.1.21", "3.1 Access Control", "Limit use of organizational portable storage devices on external systems.", 1),
  ctrl("3.1.22", "3.1 Access Control", "Control CUI posted or processed on publicly accessible systems.", 1),

  // 3.2 Awareness and Training (3)
  ctrl("3.2.1", "3.2 Awareness and Training", "Ensure managers, administrators, and users of organizational systems are made aware of the security risks associated with their activities and the applicable policies, standards, and procedures.", 3),
  ctrl("3.2.2", "3.2 Awareness and Training", "Ensure personnel are trained to carry out their assigned information security-related duties and responsibilities.", 3),
  ctrl("3.2.3", "3.2 Awareness and Training", "Provide security awareness training on recognizing and reporting potential indicators of insider threat.", 1),

  // 3.3 Audit and Accountability (9)
  ctrl("3.3.1", "3.3 Audit and Accountability", "Create and retain system audit logs and records to the extent needed to enable monitoring, analysis, investigation, and reporting of unlawful or unauthorized activity.", 5),
  ctrl("3.3.2", "3.3 Audit and Accountability", "Ensure that the actions of individual system users can be uniquely traced to those users so they can be held accountable.", 3),
  ctrl("3.3.3", "3.3 Audit and Accountability", "Review and update logged events.", 1),
  ctrl("3.3.4", "3.3 Audit and Accountability", "Alert in the event of an audit logging process failure.", 1),
  ctrl("3.3.5", "3.3 Audit and Accountability", "Correlate audit record review, analysis, and reporting processes for investigation and response to indications of unlawful, unauthorized, suspicious, or unusual activity.", 5),
  ctrl("3.3.6", "3.3 Audit and Accountability", "Provide audit record reduction and report generation to support on-demand analysis and reporting.", 1),
  ctrl("3.3.7", "3.3 Audit and Accountability", "Provide a system capability that compares and synchronizes internal system clocks with an authoritative source.", 1),
  ctrl("3.3.8", "3.3 Audit and Accountability", "Protect audit information and audit logging tools from unauthorized access, modification, and deletion.", 1),
  ctrl("3.3.9", "3.3 Audit and Accountability", "Limit management of audit logging functionality to a subset of privileged users.", 1),

  // 3.4 Configuration Management (9)
  ctrl("3.4.1", "3.4 Configuration Management", "Establish and maintain baseline configurations and inventories of organizational systems.", 5),
  ctrl("3.4.2", "3.4 Configuration Management", "Establish and enforce security configuration settings for information technology products employed in organizational systems.", 5),
  ctrl("3.4.3", "3.4 Configuration Management", "Track, review, approve, or disapprove, and log changes to organizational systems.", 1),
  ctrl("3.4.4", "3.4 Configuration Management", "Analyze the security impact of changes prior to implementation.", 1),
  ctrl("3.4.5", "3.4 Configuration Management", "Define, document, approve, and enforce physical and logical access restrictions associated with changes to organizational systems.", 1),
  ctrl("3.4.6", "3.4 Configuration Management", "Employ the principle of least functionality by configuring organizational systems to provide only essential capabilities.", 5),
  ctrl("3.4.7", "3.4 Configuration Management", "Restrict, disable, or prevent the use of nonessential programs, functions, ports, protocols, and services.", 5),
  ctrl("3.4.8", "3.4 Configuration Management", "Apply deny-by-exception (blacklisting) policy to prevent the use of unauthorized software or deny-all, permit-by-exception (whitelisting) policy to allow the execution of authorized software.", 5),
  ctrl("3.4.9", "3.4 Configuration Management", "Control and monitor user-installed software.", 1),

  // 3.5 Identification and Authentication (11)
  ctrl("3.5.1", "3.5 Identification and Authentication", "Identify system users, processes acting on behalf of users, and devices.", 5),
  ctrl("3.5.2", "3.5 Identification and Authentication", "Authenticate (or verify) the identities of users, processes, or devices, as a prerequisite to allowing access to organizational systems.", 5),
  ctrl("3.5.3", "3.5 Identification and Authentication", "Use multifactor authentication for local and network access to privileged accounts and for network access to non-privileged accounts.", 5),
  ctrl("3.5.4", "3.5 Identification and Authentication", "Employ replay-resistant authentication mechanisms for network access to privileged and non-privileged accounts.", 1),
  ctrl("3.5.5", "3.5 Identification and Authentication", "Prevent reuse of identifiers for a defined period.", 1),
  ctrl("3.5.6", "3.5 Identification and Authentication", "Disable identifiers after a defined period of inactivity.", 1),
  ctrl("3.5.7", "3.5 Identification and Authentication", "Enforce a minimum password complexity and change of characters when new passwords are created.", 5),
  ctrl("3.5.8", "3.5 Identification and Authentication", "Prohibit password reuse for a specified number of generations.", 1),
  ctrl("3.5.9", "3.5 Identification and Authentication", "Allow temporary password use for system logons with an immediate change to a permanent password.", 1),
  ctrl("3.5.10", "3.5 Identification and Authentication", "Store and transmit only cryptographically-protected passwords.", 5),
  ctrl("3.5.11", "3.5 Identification and Authentication", "Obscure feedback of authentication information.", 1),

  // 3.6 Incident Response (3)
  ctrl("3.6.1", "3.6 Incident Response", "Establish an operational incident-handling capability for organizational systems that includes preparation, detection, analysis, containment, recovery, and user response activities.", 5),
  ctrl("3.6.2", "3.6 Incident Response", "Track, document, and report incidents to designated officials and/or authorities both internal and external to the organization.", 5),
  ctrl("3.6.3", "3.6 Incident Response", "Test the organizational incident response capability.", 1),

  // 3.7 Maintenance (6)
  ctrl("3.7.1", "3.7 Maintenance", "Perform maintenance on organizational systems.", 1),
  ctrl("3.7.2", "3.7 Maintenance", "Provide controls on the tools, techniques, mechanisms, and personnel used to conduct system maintenance.", 1),
  ctrl("3.7.3", "3.7 Maintenance", "Ensure equipment removed for off-site maintenance is sanitized of any CUI.", 1),
  ctrl("3.7.4", "3.7 Maintenance", "Check media containing diagnostic and test programs for malicious code before the media are used in organizational systems.", 3),
  ctrl("3.7.5", "3.7 Maintenance", "Require multifactor authentication to establish nonlocal maintenance sessions via external network connections and terminate such connections when nonlocal maintenance is complete.", 5),
  ctrl("3.7.6", "3.7 Maintenance", "Supervise the maintenance activities of maintenance personnel without required access authorization.", 1),

  // 3.8 Media Protection (9)
  ctrl("3.8.1", "3.8 Media Protection", "Protect (i.e., physically control and securely store) system media containing CUI, both paper and digital.", 1),
  ctrl("3.8.2", "3.8 Media Protection", "Limit access to CUI on system media to authorized users.", 1),
  ctrl("3.8.3", "3.8 Media Protection", "Sanitize or destroy system media containing CUI before disposal or release for reuse.", 1),
  ctrl("3.8.4", "3.8 Media Protection", "Mark media with necessary CUI markings and distribution limitations.", 1),
  ctrl("3.8.5", "3.8 Media Protection", "Control access to media containing CUI and maintain accountability for media during transport outside of controlled areas.", 1),
  ctrl("3.8.6", "3.8 Media Protection", "Implement cryptographic mechanisms to protect the confidentiality of CUI stored on digital media during transport unless otherwise protected by alternative physical safeguards.", 1),
  ctrl("3.8.7", "3.8 Media Protection", "Control the use of removable media on system components.", 5),
  ctrl("3.8.8", "3.8 Media Protection", "Prohibit the use of portable storage devices when such devices have no identifiable owner.", 5),
  ctrl("3.8.9", "3.8 Media Protection", "Protect the confidentiality of backup CUI at storage locations.", 1),

  // 3.9 Personnel Security (2)
  ctrl("3.9.1", "3.9 Personnel Security", "Screen individuals prior to authorizing access to organizational systems containing CUI.", 1),
  ctrl("3.9.2", "3.9 Personnel Security", "Ensure that organizational systems containing CUI are protected during and after personnel actions such as terminations and transfers.", 1),

  // 3.10 Physical Protection (6)
  ctrl("3.10.1", "3.10 Physical Protection", "Limit physical access to organizational systems, equipment, and the respective operating environments to authorized individuals.", 5),
  ctrl("3.10.2", "3.10 Physical Protection", "Protect and monitor the physical facility and support infrastructure for organizational systems.", 5),
  ctrl("3.10.3", "3.10 Physical Protection", "Escort visitors and monitor visitor activity.", 1),
  ctrl("3.10.4", "3.10 Physical Protection", "Maintain audit logs of physical access.", 1),
  ctrl("3.10.5", "3.10 Physical Protection", "Control and manage physical access devices.", 1),
  ctrl("3.10.6", "3.10 Physical Protection", "Enforce safeguarding measures for CUI at alternate work sites.", 1),

  // 3.11 Risk Assessment (3)
  ctrl("3.11.1", "3.11 Risk Assessment", "Periodically assess the risk to organizational operations (including mission, functions, image, or reputation), organizational assets, and individuals, resulting from the operation of organizational systems and the associated processing, storage, or transmission of CUI.", 3),
  ctrl("3.11.2", "3.11 Risk Assessment", "Scan for vulnerabilities in organizational systems and applications periodically and when new vulnerabilities affecting those systems and applications are identified.", 5),
  ctrl("3.11.3", "3.11 Risk Assessment", "Remediate vulnerabilities in accordance with risk assessments.", 1),

  // 3.12 Security Assessment (4)
  ctrl("3.12.1", "3.12 Security Assessment", "Periodically assess the security controls in organizational systems to determine if the controls are effective in their application.", 5),
  ctrl("3.12.2", "3.12 Security Assessment", "Develop and implement plans of action designed to correct deficiencies and reduce or eliminate vulnerabilities in organizational systems.", 3),
  ctrl("3.12.3", "3.12 Security Assessment", "Monitor security controls on an ongoing basis to ensure the continued effectiveness of the controls.", 5),
  ctrl("3.12.4", "3.12 Security Assessment", "Develop, document, and periodically update system security plans that describe system boundaries, system environments of operation, how security requirements are implemented, and the relationships with or connections to other systems.", 1),

  // 3.13 System and Communications Protection (16)
  ctrl("3.13.1", "3.13 System and Communications Protection", "Monitor, control, and protect communications (i.e., information transmitted or received by organizational systems) at the external boundaries and key internal boundaries of organizational systems.", 5),
  ctrl("3.13.2", "3.13 System and Communications Protection", "Employ architectural designs, software development techniques, and systems engineering principles that promote effective information security within organizational systems.", 5),
  ctrl("3.13.3", "3.13 System and Communications Protection", "Separate user functionality from system management functionality.", 1),
  ctrl("3.13.4", "3.13 System and Communications Protection", "Prevent unauthorized and unintended information transfer via shared system resources.", 1),
  ctrl("3.13.5", "3.13 System and Communications Protection", "Implement subnetworks for publicly accessible system components that are physically or logically separated from internal networks.", 5),
  ctrl("3.13.6", "3.13 System and Communications Protection", "Deny network communications traffic by default and allow network communications traffic by exception (i.e., deny all, permit by exception).", 5),
  ctrl("3.13.7", "3.13 System and Communications Protection", "Prevent remote devices from simultaneously establishing non-remote connections with organizational systems and communicating via some other connection to resources in external networks (i.e., split tunneling).", 1),
  ctrl("3.13.8", "3.13 System and Communications Protection", "Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI during transmission unless otherwise protected by alternative physical safeguards.", 5),
  ctrl("3.13.9", "3.13 System and Communications Protection", "Terminate network connections associated with communications sessions at the end of the sessions or after a defined period of inactivity.", 1),
  ctrl("3.13.10", "3.13 System and Communications Protection", "Establish and manage cryptographic keys for cryptography employed in organizational systems.", 5),
  ctrl("3.13.11", "3.13 System and Communications Protection", "Employ FIPS-validated cryptography when used to protect the confidentiality of CUI.", 5),
  ctrl("3.13.12", "3.13 System and Communications Protection", "Prohibit remote activation of collaborative computing devices and provide indication of devices in use to users present at the device.", 1),
  ctrl("3.13.13", "3.13 System and Communications Protection", "Control and monitor the use of mobile code.", 1),
  ctrl("3.13.14", "3.13 System and Communications Protection", "Control and monitor the use of Voice over Internet Protocol (VoIP) technologies.", 5),
  ctrl("3.13.15", "3.13 System and Communications Protection", "Protect the authenticity of communications sessions.", 5),
  ctrl("3.13.16", "3.13 System and Communications Protection", "Protect the confidentiality of CUI at rest.", 1),

  // 3.14 System and Information Integrity (7)
  ctrl("3.14.1", "3.14 System and Information Integrity", "Identify, report, and correct system flaws in a timely manner.", 5),
  ctrl("3.14.2", "3.14 System and Information Integrity", "Provide protection from malicious code at designated locations within organizational systems.", 5),
  ctrl("3.14.3", "3.14 System and Information Integrity", "Monitor system security alerts and advisories and take action in response.", 5),
  ctrl("3.14.4", "3.14 System and Information Integrity", "Update malicious code protection mechanisms when new releases are available.", 5),
  ctrl("3.14.5", "3.14 System and Information Integrity", "Perform periodic scans of organizational systems and real-time scans of files from external sources as files are downloaded, opened, or executed.", 3),
  ctrl("3.14.6", "3.14 System and Information Integrity", "Monitor organizational systems, including inbound and outbound communications traffic, to detect attacks and indicators of potential attacks.", 5),
  ctrl("3.14.7", "3.14 System and Information Integrity", "Identify unauthorized use of organizational systems.", 3),

  // Evidence text per family (14)
  { id: "NOTES.3.1", section: "3.1 Access Control · Evidence", prompt: "Evidence and notes for Access Control", type: "text", required: false },
  { id: "NOTES.3.2", section: "3.2 Awareness and Training · Evidence", prompt: "Evidence and notes for Awareness & Training", type: "text", required: false },
  { id: "NOTES.3.3", section: "3.3 Audit and Accountability · Evidence", prompt: "Evidence and notes for Audit & Accountability", type: "text", required: false },
  { id: "NOTES.3.4", section: "3.4 Configuration Management · Evidence", prompt: "Evidence and notes for Configuration Management", type: "text", required: false },
  { id: "NOTES.3.5", section: "3.5 Identification and Authentication · Evidence", prompt: "Evidence and notes for Identification & Authentication", type: "text", required: false },
  { id: "NOTES.3.6", section: "3.6 Incident Response · Evidence", prompt: "Evidence and notes for Incident Response", type: "text", required: false },
  { id: "NOTES.3.7", section: "3.7 Maintenance · Evidence", prompt: "Evidence and notes for Maintenance", type: "text", required: false },
  { id: "NOTES.3.8", section: "3.8 Media Protection · Evidence", prompt: "Evidence and notes for Media Protection", type: "text", required: false },
  { id: "NOTES.3.9", section: "3.9 Personnel Security · Evidence", prompt: "Evidence and notes for Personnel Security", type: "text", required: false },
  { id: "NOTES.3.10", section: "3.10 Physical Protection · Evidence", prompt: "Evidence and notes for Physical Protection", type: "text", required: false },
  { id: "NOTES.3.11", section: "3.11 Risk Assessment · Evidence", prompt: "Evidence and notes for Risk Assessment", type: "text", required: false },
  { id: "NOTES.3.12", section: "3.12 Security Assessment · Evidence", prompt: "Evidence and notes for Security Assessment", type: "text", required: false },
  { id: "NOTES.3.13", section: "3.13 System and Communications Protection · Evidence", prompt: "Evidence and notes for System & Communications Protection", type: "text", required: false },
  { id: "NOTES.3.14", section: "3.14 System and Information Integrity · Evidence", prompt: "Evidence and notes for System & Information Integrity", type: "text", required: false },

  // Target CMMC level
  {
    id: "TARGET_LEVEL",
    section: "Target",
    prompt: "Target CMMC level the customer needs to achieve",
    type: "single_select",
    required: false,
    options: [
      { value: "level_1", label: "CMMC Level 1 (Foundational — FCI only)" },
      { value: "level_2", label: "CMMC Level 2 (Advanced — NIST 800-171 alignment)" },
      { value: "level_3", label: "CMMC Level 3 (Expert — NIST 800-172 added)" },
    ],
  },
];

export const NIST_800_171_BANK: DiscoveryBank = {
  kind: "NIST_800_171",
  questions: NIST_800_171_QUESTIONS,
};

export const SP800_171_FAMILIES = [
  "3.1 Access Control",
  "3.2 Awareness and Training",
  "3.3 Audit and Accountability",
  "3.4 Configuration Management",
  "3.5 Identification and Authentication",
  "3.6 Incident Response",
  "3.7 Maintenance",
  "3.8 Media Protection",
  "3.9 Personnel Security",
  "3.10 Physical Protection",
  "3.11 Risk Assessment",
  "3.12 Security Assessment",
  "3.13 System and Communications Protection",
  "3.14 System and Information Integrity",
] as const;
