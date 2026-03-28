/**
 * Fix DataSource sourceClientId and sourceClientName values
 *
 * INGLAB uses two distinct identifiers:
 * - client_id: Used in ?client_id= URL query param (e.g., "PIZZAHUT", "AIAMY", "ZURICH")
 * - source_client_name: Used for filtering nested results (e.g., "Pizza Hut", "AIA Malaysia")
 *
 * The migration script incorrectly set sourceClientId to source_client_name values.
 * This script corrects both fields based on the /clients API response.
 *
 * Run: npx tsx scripts/fix-inglab-sourceClientId.ts
 */

import { getDatabase } from "../src/infrastructure/db/mongodb";

const FIXES = [
  // client_id values from INGLAB /clients API + source_client_name for nested filter
  { name: "AIA Malaysia",      sourceClientId: "AIAMY",       sourceClientName: "AIA Malaysia",      serviceType: "WHATSAPP" as const },
  { name: "Zurich Malaysia",   sourceClientId: "ZURICH",      sourceClientName: "Zurich Malaysia",   serviceType: "WHATSAPP" as const },
  { name: "FWD Takaful",       sourceClientId: "FWD",         sourceClientName: "FWD Takaful",       serviceType: "WHATSAPP" as const },
  { name: "Prudential Malaysia", sourceClientId: "PRUDENTIAL", sourceClientName: "Prudential Malaysia", serviceType: "WHATSAPP" as const },
  { name: "Pizza Hut",         sourceClientId: "PIZZAHUT",    sourceClientName: "Pizza Hut",         serviceType: "WHATSAPP" as const },
];

async function main() {
  const db = await getDatabase();

  let updated = 0;
  let notFound = 0;

  for (const fix of FIXES) {
    const ds = await db.collection("dataSources").findOne({
      name: { $regex: `INGLAB.*${fix.name}`, $options: "i" },
    });

    if (!ds) {
      console.log(`❌ Not found: INGLAB.*${fix.name}`);
      notFound++;
      continue;
    }

    await db.collection("dataSources").updateOne(
      { _id: ds._id },
      {
        $set: {
          sourceClientId: fix.sourceClientId,
          sourceClientName: fix.sourceClientName,
          serviceType: fix.serviceType,
        },
      }
    );

    console.log(
      `✅ ${ds.name}: sourceClientId="${fix.sourceClientId}", sourceClientName="${fix.sourceClientName}"`
    );
    updated++;
  }

  console.log(`\n📊 Fixed: ${updated}, Not found: ${notFound}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Failed:", err);
  process.exit(1);
});
