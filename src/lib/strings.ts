/**
 * Centralized user-facing strings — single point for future i18n.
 */
export const STRINGS = {
  appName: "Gateway TelNet Sales Portal",
  brand: { tagline: "Sales made simple. Operations made sure." },
  nav: {
    home: "Home",
    leads: "Leads",
    pipeline: "Pipeline",
    newLead: "New",
    notifications: "Notifications",
    me: "Me",
    admin: "Admin",
    handoff: "Handoff",
    accounts: "Accounts",
    myTasks: "My tasks",
    pricing: "Pricing",
    help: "Help",
  },
  auth: {
    title: "Sign in to Gateway",
    magicLinkPrompt: "We'll email you a magic link.",
    passwordPrompt: "Or use email + password.",
    checkEmail: "Check your email — we sent you a magic link.",
    signOut: "Sign out",
    notAuthorized: "You don't have permission to view this.",
  },
  pipeline: {
    stages: {
      LEAD: "Lead",
      QUALIFIED: "Qualified",
      DISCOVERY: "Discovery",
      PRE_SALES: "Pre-Sales",
      PROPOSAL: "Proposal",
      NEGOTIATION: "Negotiation",
      CLOSED_WON: "Closed Won",
      CLOSED_LOST: "Closed Lost",
      NURTURE: "Nurture",
    } as Record<string, string>,
  },
  assessment: {
    title: "Basic IT Assessment",
    intro: "Twenty-five questions. Takes ~10 minutes.",
    next: "Next",
    back: "Back",
    submit: "Submit",
    progress: (n: number, total: number) => `Question ${n} of ${total}`,
    nonStrategicBanner: "This deal is flagged non-strategic. Sales Manager approval required to advance past Proposal.",
  },
  scoring: {
    services: "Services Score",
    customer: "Customer Score",
    dealQuality: "Deal Quality",
    buckets: {
      lighthouse: "Lighthouse",
      strong_fit: "Strong Fit",
      marginal: "Marginal",
      refer_or_wait: "Refer or Wait",
      polite_decline: "Polite Decline",
    } as Record<string, string>,
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    forbidden: "You don't have permission.",
    notFound: "Not found.",
    validation: "Please fix the highlighted fields.",
  },
};

export type Strings = typeof STRINGS;
