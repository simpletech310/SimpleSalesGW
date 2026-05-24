/**
 * scripts/import-prospects.ts
 *
 * One-shot CLI to seed the 25 Burbank-area shortlist prospects as Leads
 * owned by lin@gatewaytelnet.com (or `--owner=<email>`). Idempotent —
 * skips any row whose businessName already exists.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/import-prospects.ts
 *   npx tsx --env-file=.env.local scripts/import-prospects.ts --owner=lin@gatewaytelnet.com
 */

import { PrismaClient } from "@prisma/client";
import { importBurbankProspects } from "../src/lib/prospects/import";

const prisma = new PrismaClient();

async function main() {
  const ownerArg = process.argv.find((a) => a.startsWith("--owner="));
  const ownerEmail = ownerArg ? ownerArg.slice("--owner=".length) : undefined;

  const result = await importBurbankProspects({ ownerEmail });
  console.log(
    `\nImported ${result.created} of ${result.total} prospects ` +
    `(${result.skipped} already existed) under ${result.ownerEmail}.\n`,
  );
  if (result.createdNames.length > 0) {
    console.log("Created:");
    for (const n of result.createdNames) console.log(`  + ${n}`);
  }
  if (result.skippedNames.length > 0) {
    console.log("\nSkipped (already existed):");
    for (const n of result.skippedNames) console.log(`  · ${n}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
