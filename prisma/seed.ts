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
