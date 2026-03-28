/**
 * Fix DataSource sourceClientId values after migration
 *
 * The migration script incorrectly set sourceClientId to "CLIENT-*" values.
 * INGLAB actually uses source_client_name (e.g., "AIA Malaysia") as the identifier.
 *
 * Run: npx tsx scripts/fix-inglab-sourceClientId.ts
 */

import { getDatabase } from "../src/infrastructure/db/mongodb";

const FIXES = [
  { name: "AIA Malaysia", sourceClientId: "AIA Malaysia", serviceType: "WHATSAPP" as const },
  { name: "Zurich Malaysia", sourceClientId: "Zurich Malaysia", serviceType: "WHATSAPP" as const },
  { name: "FWD Takaful", sourceClientId: "FWD Takaful", serviceType: "WHATSAPP" as const },
  { name: "Prudential Malaysia", sourceClientId: "Prudential Malaysia", serviceType: "WHATSAPP" as const },
  { name: "Pizza Hut", sourceClientId: "Pizza Hut", serviceType: "WHATSAPP" as const },
];

async function main() {
  const db = await getDatabase();

  let updated = 0;
  let notFound = 0;

  for (const fix of FIXES) {
    // Find DataSource by name pattern
    const ds = await db.collection("dataSources").findOne({
      name: { $regex: `INGLAB.*${fix.name}`, $options: "i" },
    });

    if (!ds) {
      console.log(`❌ Not found: INGLAB.*${fix.name}`);
      notFound++;
      continue;
    }

    const result = await db.collection("dataSources").updateOne(
      { _id: ds._id },
      { $set: { sourceClientId: fix.sourceClientId, serviceType: fix.serviceType } }
    );

    console.log(`✅ ${ds.name}: sourceClientId → "${fix.sourceClientId}", serviceType → "${fix.serviceType}"`);
    updated++;
  }

  console.log(`\n📊 Fixed: ${updated}, Not found: ${notFound}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Failed:", err);
  process.exit(1);
});
