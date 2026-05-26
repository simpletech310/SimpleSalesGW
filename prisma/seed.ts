import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(opts: {
  email: string;
  name: string;
  role: Role;
  password?: string;
}) {
  const passwordHash = opts.password ? await bcrypt.hash(opts.password, 10) : null;
  return prisma.user.upsert({
    where: { email: opts.email },
    update: { name: opts.name, role: opts.role, active: true },
    create: {
      email: opts.email,
      name: opts.name,
      role: opts.role,
      active: true,
      passwordHash,
      emailVerified: new Date(),
    },
  });
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("→ Seeding users...");

  // Default fallback password for all seed users is "gateway123" (dev only).
  const DEV_PW = "gateway123";

  const admin = await upsertUser({
    email: "admin@gatewaytelnet.com",
    name: "Marcelo Blatt",
    role: Role.SUPERADMIN,
    password: DEV_PW,
  });
  const lin = await upsertUser({
    email: "lin@gatewaytelnet.com",
    name: "Lin",
    role: Role.SALESPERSON,
    password: DEV_PW,
  });
  await upsertUser({
    email: "salesmgr@gatewaytelnet.com",
    name: "Marcelo Blatt",
    role: Role.SALES_MANAGER,
    password: DEV_PW,
  });
  await upsertUser({
    email: "teejay@gatewaytelnet.com",
    name: "Teejay",
    role: Role.VCIO,
    password: DEV_PW,
  });
  await upsertUser({
    email: "coo@gatewaytelnet.com",
    name: "Marcelo Blatt",
    role: Role.COO,
    password: DEV_PW,
  });

  // v2.13 — demo lead block removed. Real prospect list lives in
  // `docs/prospects-burbank.md` and gets entered through the UI by Lin so
  // each gets a real owner, real research, real outreach trail rather than
  // a synthetic seed. Keeping a no-op so a future re-seed never overwrites.
  void lin;
  // eslint-disable-next-line no-console
  console.log("→ Skipping demo leads (entered via UI in v2.13+).");

  // eslint-disable-next-line no-console
  console.log("→ Seeding system config defaults...");
  await prisma.systemConfig.upsert({
    where: { key: "scoring.thresholds" },
    update: { value: { servicesBelow: 35, dealQualityBelow: 40 } },
    create: {
      key: "scoring.thresholds",
      value: { servicesBelow: 35, dealQualityBelow: 40 },
    },
  });

  // eslint-disable-next-line no-console
  console.log("→ Seeding objections library (v2.2)...");
  const { DEFAULT_OBJECTIONS } = await import("../src/lib/objections/defaults");
  for (const o of DEFAULT_OBJECTIONS) {
    const existing = await prisma.objectionTemplate.findFirst({
      where: { trigger: o.trigger, category: o.category, industry: o.industry ?? null },
    });
    if (existing) {
      await prisma.objectionTemplate.update({
        where: { id: existing.id },
        data: {
          rebuttal: o.rebuttal,
          source: o.source ?? null,
          active: true,
        },
      });
    } else {
      await prisma.objectionTemplate.create({
        data: {
          category: o.category,
          industry: o.industry ?? null,
          trigger: o.trigger,
          rebuttal: o.rebuttal,
          source: o.source ?? null,
          active: true,
        },
      });
    }
  }

  // v2.21 — Seed MSP business profile if missing. Once a SUPERADMIN
  // saves their real profile via /admin/msp-profile we never want to
  // overwrite — so use `findUnique + create` instead of `upsert` here.
  // eslint-disable-next-line no-console
  console.log("→ Seeding MSP profile defaults (v2.21)...");
  const existingProfile = await prisma.systemConfig.findUnique({
    where: { key: "msp.profile" },
  });
  if (!existingProfile) {
    const { DEFAULT_PROFILE } = await import("../src/lib/msp/profile");
    await prisma.systemConfig.create({
      data: { key: "msp.profile", value: DEFAULT_PROFILE as never },
    });
  }

  // eslint-disable-next-line no-console
  console.log("→ Seeding outreach templates (v2.2)...");
  const { DEFAULT_OUTREACH_TEMPLATES, extractPlaceholders } = await import(
    "../src/lib/outreach/templates"
  );
  for (const t of DEFAULT_OUTREACH_TEMPLATES) {
    const placeholders = extractPlaceholders(`${t.subject}\n${t.body}`);
    await prisma.outreachTemplate.upsert({
      where: { name: t.name },
      update: {
        category: t.category,
        industry: t.industry ?? null,
        trigger: t.trigger ?? null,
        subject: t.subject,
        body: t.body,
        placeholders,
        active: true,
      },
      create: {
        name: t.name,
        category: t.category,
        industry: t.industry ?? null,
        trigger: t.trigger ?? null,
        subject: t.subject,
        body: t.body,
        placeholders,
        active: true,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("✓ Seed complete.");
  // eslint-disable-next-line no-console
  console.log(`  Login (magic-link OR password "${DEV_PW}"):`);
  // eslint-disable-next-line no-console
  console.log("    admin@gatewaytelnet.com       (SUPERADMIN)");
  // eslint-disable-next-line no-console
  console.log("    lin@gatewaytelnet.com         (SALESPERSON)");
  // eslint-disable-next-line no-console
  console.log("    salesmgr@gatewaytelnet.com    (SALES_MANAGER)");
  // eslint-disable-next-line no-console
  console.log("    teejay@gatewaytelnet.com      (VCIO)");
  // eslint-disable-next-line no-console
  console.log("    coo@gatewaytelnet.com         (COO)");

  // v3.3 — seed 5 starter SOW templates (one per bundle). Idempotent.
  await seedSowTemplates(admin.id);

  void admin;
}

async function seedSowTemplates(createdByUserId: string) {
  const starters: Array<{
    name: string;
    bundle: import("@prisma/client").ServiceBundle;
    description: string;
    scopeMarkdown: string;
    deliverablesMarkdown: string;
    timelineMarkdown: string;
  }> = [
    {
      name: "Essential — Managed IT starter",
      bundle: "ESSENTIAL",
      description: "Per-seat MSP coverage for smaller orgs without compliance overlay.",
      scopeMarkdown: "## Scope\n\nWe will provide Essential managed IT for **{{customer.name}}** ({{customer.seats}} seats) across {{customer.industry}}. Coverage includes:\n\n- 24/7 monitoring + remediation of endpoints, identity, and network\n- Patch management with weekly maintenance windows\n- Help-desk during business hours\n- Quarterly business reviews",
      deliverablesMarkdown: "## Deliverables\n\n- RMM agent deployment within 14 days of kickoff\n- Documented onboarding runbook by Day 21\n- Day-30 health summary delivered at first QBR\n- Monthly tickets + SLA report",
      timelineMarkdown: "## Timeline\n\n- Week 0: Kickoff + Day-1 narrative\n- Weeks 1–3: Discovery + agent rollout\n- Weeks 4–8: Onboard\n- Weeks 8+: Steady state + first QBR at Week 12",
    },
    {
      name: "Professional — Managed IT + Security stack",
      bundle: "PROFESSIONAL",
      description: "Bundle for mid-size customers with light compliance + security layering.",
      scopeMarkdown: "## Scope\n\nProfessional Managed IT + Security for **{{customer.name}}** ({{customer.seats}} seats, {{customer.industry}}). Stated pain: {{lead.statedPain}}. Includes everything in Essential plus:\n\n- Managed EDR + MDR\n- Email security gateway\n- DNS filtering\n- Annual security awareness training",
      deliverablesMarkdown: "## Deliverables\n\n- Essential deliverables\n- EDR + MDR coverage live by Day 30\n- Security awareness Year-1 campaign launched by Day 60\n- Cyber-insurance attestation letter on request",
      timelineMarkdown: "## Timeline\n\nSame as Essential, plus:\n- Weeks 2–4: Security stack rollout\n- Day 30: First risk posture summary",
    },
    {
      name: "Compliance Plus — NIST / HIPAA / CMMC",
      bundle: "COMPLIANCE_PLUS",
      description: "For customers in regulated verticals: medical, federal contracting, financial services.",
      scopeMarkdown: "## Scope\n\nCompliance Plus for **{{customer.name}}** — managed IT + security + ongoing compliance program. Compliance drivers: {{customer.complianceDrivers}}. Includes:\n\n- All Professional services\n- Annual NIST CSF or NIST 800-171 assessment\n- POAM tracking + quarterly remediation reviews\n- Cyber-insurance + audit-readiness support",
      deliverablesMarkdown: "## Deliverables\n\n- Professional deliverables\n- Year-1 NIST baseline assessment with executive summary by Day 90\n- POAM register live by Day 60 with assigned owners\n- Quarterly compliance scorecard at each QBR",
      timelineMarkdown: "## Timeline\n\n- Weeks 0–4: Standard onboard\n- Weeks 4–8: NIST baseline assessment\n- Week 12: First quarterly compliance review",
    },
    {
      name: "Enterprise — Strategic vCIO partnership",
      bundle: "ENTERPRISE",
      description: "For customers with > 100 seats or multi-site complexity that need strategic IT leadership.",
      scopeMarkdown: "## Scope\n\nEnterprise vCIO partnership for **{{customer.name}}** ({{customer.seats}} seats, multi-site). Includes all Compliance Plus services plus:\n\n- Dedicated vCIO with monthly strategy sessions\n- Annual technology roadmap + budget planning\n- Vendor management oversight\n- Strategic risk + capacity reviews",
      deliverablesMarkdown: "## Deliverables\n\n- Compliance Plus deliverables\n- Year-1 strategic roadmap document by Day 60\n- Vendor consolidation analysis at Q1 QBR\n- Annual board-ready risk + posture report",
      timelineMarkdown: "## Timeline\n\n- Week 0–8: Standard onboard\n- Week 8: First strategic roadmap draft\n- Monthly vCIO 1:1s starting Week 4",
    },
    {
      name: "Custom — Scope-per-engagement",
      bundle: "CUSTOM",
      description: "Use when none of the four bundles fit cleanly. Salesperson + vCIO co-author the scope.",
      scopeMarkdown: "## Scope\n\nCustom engagement for **{{customer.name}}**. Specific scope:\n\n[describe what we're committing to — co-authored with vCIO]\n\nDeal kind: {{deal.bundle}}",
      deliverablesMarkdown: "## Deliverables\n\n[list specific deliverables agreed during pre-sale discovery]",
      timelineMarkdown: "## Timeline\n\n[specific milestones — kickoff, midpoint check-in, completion]",
    },
  ];

  for (const t of starters) {
    const existing = await prisma.sowTemplate.findFirst({ where: { name: t.name } });
    if (existing) continue;
    await prisma.sowTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        bundle: t.bundle,
        scopeMarkdown: t.scopeMarkdown,
        deliverablesMarkdown: t.deliverablesMarkdown,
        timelineMarkdown: t.timelineMarkdown,
        exclusionsMarkdown:
          "## Exclusions\n\n- Hardware not specified in deliverables\n- Third-party SaaS licensing\n- Custom development\n- Onsite work beyond initial deployment\n- Recovery from incidents pre-dating engagement",
        termsMarkdown:
          "## Terms\n\n- Billing: monthly in advance via ACH\n- Initial term: 12 months\n- Auto-renewal: month-to-month after initial term\n- Cancellation: 60 days written notice\n- Rate review: annual",
        createdByUserId,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("[seed] SOW starter templates ensured.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
