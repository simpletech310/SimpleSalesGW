import {
  PrismaClient,
  Role,
  Industry,
  PipelineStage,
  LeadSource,
  ComplianceDriver,
  MspSatisfaction,
} from "@prisma/client";
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

  // eslint-disable-next-line no-console
  console.log("→ Seeding demo leads...");

  const demoLeads = [
    {
      businessName: "Pacific Coast Medical Group",
      industry: Industry.MEDICAL,
      seatCount: 140,
      addressCity: "San Diego",
      addressState: "CA",
      pipelineStage: PipelineStage.QUALIFIED,
      source: LeadSource.INBOUND,
      complianceDrivers: [ComplianceDriver.HIPAA],
      primaryContactName: "Dr. Anita Rao",
      primaryContactTitle: "Practice Administrator",
      primaryContactEmail: "anita.rao@example.com",
      executiveSponsorName: "Dr. James Chen",
      executiveSponsorTitle: "Managing Partner",
      currentMspName: "BlueGlass IT",
      currentMspSatisfaction: MspSatisfaction.LEAVING,
      researchSummary:
        "12-physician multi-site practice (3 locations). HIPAA pressure, cyber insurance renews Q3.",
      servicesScore: 78, customerScore: 82, dealQualityScore: 80,
    },
    {
      businessName: "Whitman Whitman & Cole LLP",
      industry: Industry.LEGAL,
      seatCount: 75,
      addressCity: "Los Angeles",
      addressState: "CA",
      pipelineStage: PipelineStage.DISCOVERY,
      source: LeadSource.REFERRAL,
      complianceDrivers: [ComplianceDriver.OTHER],
      primaryContactName: "Sarah Whitman",
      primaryContactTitle: "Managing Partner",
      primaryContactEmail: "swhitman@example.com",
      currentMspName: "In-house IT (1 person)",
      currentMspSatisfaction: MspSatisfaction.NEUTRAL,
      researchSummary:
        "Boutique litigation firm. Document management on aging on-prem fileserver. Looking at SharePoint migration.",
      servicesScore: 58, customerScore: 71, dealQualityScore: 65,
    },
    {
      businessName: "Sentinel Defense Solutions",
      industry: Industry.FEDERAL_CONTRACTING,
      seatCount: 60,
      addressCity: "Riverside",
      addressState: "CA",
      pipelineStage: PipelineStage.PRE_SALES,
      source: LeadSource.OUTBOUND,
      complianceDrivers: [ComplianceDriver.CMMC],
      primaryContactName: "Mark Travers",
      primaryContactTitle: "VP Operations",
      primaryContactEmail: "mtravers@example.com",
      executiveSponsorName: "Erica Long",
      executiveSponsorTitle: "CEO",
      currentMspName: "None",
      currentMspSatisfaction: MspSatisfaction.NONE,
      researchSummary:
        "DoD subcontractor pursuing CMMC Level 2 certification. NIST SP 800-171 work needed.",
      servicesScore: 84, customerScore: 86, dealQualityScore: 85,
    },
    {
      businessName: "Vanguard Precision Manufacturing",
      industry: Industry.MANUFACTURING,
      seatCount: 110,
      addressCity: "Anaheim",
      addressState: "CA",
      pipelineStage: PipelineStage.LEAD,
      source: LeadSource.EVENT,
      complianceDrivers: [ComplianceDriver.NONE],
      primaryContactName: "Hugh Park",
      primaryContactTitle: "COO",
      primaryContactEmail: "hpark@example.com",
      currentMspName: "Local break-fix vendor",
      currentMspSatisfaction: MspSatisfaction.LEAVING,
      researchSummary:
        "Custom CNC shop. Frequent network outages on shop floor. Considering full MSP move.",
      servicesScore: 70, customerScore: 64, dealQualityScore: 67,
    },
    {
      businessName: "Coastal Hospitality Group",
      industry: Industry.HOSPITALITY,
      seatCount: 220,
      siteCount: 4,
      addressCity: "Long Beach",
      addressState: "CA",
      pipelineStage: PipelineStage.PROPOSAL,
      source: LeadSource.PARTNER,
      complianceDrivers: [ComplianceDriver.PCI],
      primaryContactName: "Carla Mendez",
      primaryContactTitle: "Director of IT",
      primaryContactEmail: "cmendez@example.com",
      executiveSponsorName: "Tom Westbrook",
      executiveSponsorTitle: "CFO",
      currentMspName: "Regional MSP (declining)",
      currentMspSatisfaction: MspSatisfaction.LEAVING,
      researchSummary:
        "Four-property boutique hotel group. PCI on point-of-sale. Phone system replacement underway.",
      servicesScore: 88, customerScore: 90, dealQualityScore: 89,
    },
  ];

  for (const lead of demoLeads) {
    const existing = await prisma.lead.findFirst({
      where: { businessName: lead.businessName },
    });
    if (existing) continue;
    await prisma.lead.create({
      data: {
        ...lead,
        ownerUserId: lin.id,
      },
    });
  }

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

  void admin;
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
