/**
 * Migration Script: Attach INGLAB DataSources to existing customers
 *
 * Run: npx tsx scripts/migrate-inglab-customers.ts
 *
 * This script finds existing customers (AIA Malaysia, Zurich Malaysia, FWD Takaful,
 * Prudential Malaysia, Pizza Hut) and attaches INGLAB DataSource records to them.
 *
 * Uses the shared INGLAB API token from .env.local (AUTOCOUNT_API_TOKEN).
 * The sourceClientId (e.g., CLIENT-AIA) goes into the URL as a query param per customer.
 */

import { connectDatabase, getDatabase } from "../src/infrastructure/db/mongodb";

const INGLAB_BASE_URL = "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB";

interface IngLabCustomer {
  name: string;
  displayName: string;
  sourceClientId: string;
  serviceType: "SMS" | "WHATSAPP";
}

const INGLAB_CUSTOMERS: IngLabCustomer[] = [
  {
    name: "AIA Malaysia",
    displayName: "AIA Malaysia",
    sourceClientId: "CLIENT-AIA",
    serviceType: "SMS",
  },
  {
    name: "Zurich Malaysia",
    displayName: "Zurich Malaysia",
    sourceClientId: "CLIENT-ZURICH",
    serviceType: "SMS",
  },
  {
    name: "FWD Takaful",
    displayName: "FWD Takaful",
    sourceClientId: "CLIENT-FWD",
    serviceType: "SMS",
  },
  {
    name: "Prudential Malaysia",
    displayName: "Prudential Malaysia",
    sourceClientId: "CLIENT-PRUDENTIAL",
    serviceType: "SMS",
  },
  {
    name: "Pizza Hut",
    displayName: "Pizza Hut",
    sourceClientId: "CLIENT-PIZZAHUT",
    serviceType: "SMS",
  },
];

async function main() {
  await connectDatabase();
  const db = getDatabase();

  // Get shared INGLAB token from env
  const sharedToken = process.env.AUTOCOUNT_API_TOKEN;
  if (!sharedToken) {
    console.error("❌ Error: AUTOCOUNT_API_TOKEN not found in .env.local");
    console.error("   This is the shared INGLAB API token for all clients.");
    process.exit(1);
  }

  console.log("🔄 INGLAB DataSource Migration\n");
  console.log(`✅ Using shared token: ${sharedToken.slice(0, 8)}...\n`);

  let migrated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const inglab of INGLAB_CUSTOMERS) {
    // Find existing customer by name
    const customer = await db.collection("customers").findOne({ name: inglab.name });

    if (!customer) {
      console.log(`❌ Customer not found: "${inglab.name}"`);
      notFound++;
      continue;
    }

    console.log(`\n📋 Found customer: ${inglab.name} (${customer.id})`);

    // Check if INGLAB DataSource already exists for this customer
    const existingDs = await db.collection("dataSources").findOne({
      customerId: customer.id,
      sourceClientId: inglab.sourceClientId,
    });

    if (existingDs) {
      console.log(`   ⏭️  DataSource already exists: ${existingDs.id} (${inglab.sourceClientId})`);
      skipped++;
      continue;
    }

    const dataSourceId = `ds_inglab_${inglab.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

    const dataSource = {
      id: dataSourceId,
      customerId: customer.id,
      type: "CUSTOM_REST_API" as const,
      serviceType: inglab.serviceType,
      name: `INGLAB - ${inglab.displayName}`,
      apiEndpoint: `${INGLAB_BASE_URL}/billable`,
      authType: "BEARER_TOKEN" as const,
      authCredentials: {
        token: sharedToken,
      },
      sourceClientId: inglab.sourceClientId,
      nestedResponseConfig: {
        itemsPath: "items",
        lineItemsPath: "line_items",
        descriptionPath: "description",
        descriptionDetailPath: "description_detail",
        qtyPath: "qty",
        unitPricePath: "unit_price",
        servicePath: "service",
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("dataSources").insertOne(dataSource);

    console.log(`   ✅ Created DataSource: ${dataSourceId}`);
    console.log(`   📌 sourceClientId: ${inglab.sourceClientId} (client_id query param)`);
    migrated++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Not found: ${notFound}`);

  if (migrated > 0) {
    console.log(`\n✅ Migration complete! ${migrated} DataSource(s) created.`);
  } else if (skipped > 0) {
    console.log(`\nℹ️  All customers already have INGLAB DataSources.`);
  } else if (notFound > 0) {
    console.log(`\n⚠️  ${notFound} customer(s) not found in MongoDB. Check customer names.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
