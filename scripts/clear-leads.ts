/**
 * scripts/clear-leads.ts
 *
 * One-shot purge: remove all Lead rows. Cascades take care of related
 * Activity / Note / Assessment / ServiceMatch / ResearchArtifact / Handoff /
 * Attachment / PricingApproval / SignedDocument / QualificationScorecard /
 * DiscoveryCallNote / ObjectionLog rows (all declared `onDelete: Cascade`
 * against Lead in prisma/schema.prisma).
 *
 * Customer rows that came from accepted handoffs are *also* removed because
 * Customer.leadId → Lead is `onDelete: Cascade`. If you want to keep
 * Customers, delete them first with a separate carve-out.
 *
 * Run:
 *   npx tsx scripts/clear-leads.ts
 *   npx tsx scripts/clear-leads.ts --keep-customers
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const keepCustomers = process.argv.includes("--keep-customers");

  const leadCount = await prisma.lead.count();
  const customerCount = await prisma.customer.count();

  console.log(`Current state: ${leadCount} leads, ${customerCount} customers`);
  if (leadCount === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (keepCustomers) {
    // Detach leadId-cascade by deleting only the Lead rows that have no Customer.
    const orphans = await prisma.lead.findMany({
      where: { customer: null },
      select: { id: true },
    });
    const ids = orphans.map((l) => l.id);
    const res = await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `Deleted ${res.count} leads without a Customer. Skipped ${leadCount - res.count} with active Customers.`,
    );
  } else {
    const res = await prisma.lead.deleteMany({});
    console.log(`Deleted ${res.count} leads (and cascaded children).`);
  }

  // Sanity readback.
  const after = await prisma.lead.count();
  console.log(`Leads remaining: ${after}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
