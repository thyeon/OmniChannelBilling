/**
 * Migration Script: Attach INGLAB DataSources to existing customers
 *
 * Run: npx tsx scripts/migrate-inglab-customers.ts
 *
 * This script finds existing customers (AIA Malaysia, Zurich Malaysia, FWD Takaful,
 * Prudential Malaysia, Pizza Hut) and attaches INGLAB DataSource records to them.
 *
 * NOTE: Per-customer API tokens must be set in .env:
 *   INGLAB_TOKEN_CLIENT-AIA=your-aia-token
 *   INGLAB_TOKEN_CLIENT-ZURICH=your-zurich-token
 *   INGLAB_TOKEN_CLIENT-FWD=your-fwd-token
 *   INGLAB_TOKEN_CLIENT-PRUDENTIAL=your-prudential-token
 *   INGLAB_TOKEN_CLIENT-PIZZAHUT=your-pizzahut-token
 */

import { connectDatabase, getDatabase } from "../src/infrastructure/db/mongodb";

const INGLAB_BASE_URL = "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB";

interface IngLabCustomer {
  name: string;
  displayName: string;
  sourceClientId: string;
  tokenEnvKey: string;
  serviceType: "SMS" | "WHATSAPP";
}

const INGLAB_CUSTOMERS: IngLabCustomer[] = [
  {
    name: "AIA Malaysia",
    displayName: "AIA Malaysia",
    sourceClientId: "CLIENT-AIA",
    tokenEnvKey: "INGLAB_TOKEN_CLIENT-AIA",
    serviceType: "SMS",
  },
  {
    name: "Zurich Malaysia",
    displayName: "Zurich Malaysia",
    sourceClientId: "CLIENT-ZURICH",
    tokenEnvKey: "INGLAB_TOKEN_CLIENT-ZURICH",
    serviceType: "SMS",
  },
  {
    name: "FWD Takaful",
    displayName: "FWD Takaful",
    sourceClientId: "CLIENT-FWD",
    tokenEnvKey: "INGLAB_TOKEN_CLIENT-FWD",
    serviceType: "SMS",
  },
  {
    name: "Prudential Malaysia",
    displayName: "Prudential Malaysia",
    sourceClientId: "CLIENT-PRUDENTIAL",
    tokenEnvKey: "INGLAB_TOKEN_CLIENT-PRUDENTIAL",
    serviceType: "SMS",
  },
  {
    name: "Pizza Hut",
    displayName: "Pizza Hut",
    sourceClientId: "CLIENT-PIZZAHUT",
    tokenEnvKey: "INGLAB_TOKEN_CLIENT-PIZZAHUT",
    serviceType: "SMS",
  },
];

async function main() {
  await connectDatabase();
  const db = getDatabase();

  console.log("🔄 INGLAB DataSource Migration\n");
  console.log("This script will attach INGLAB DataSources to existing customers.\n");

  // Check for token env vars
  const missingTokens: string[] = [];
  for (const customer of INGLAB_CUSTOMERS) {
    if (!process.env[customer.tokenEnvKey]) {
      missingTokens.push(customer.tokenEnvKey);
    }
  }

  if (missingTokens.length > 0) {
    console.warn("⚠️  Warning: Missing environment variables:");
    for (const key of missingTokens) {
      console.warn(`   - ${key}`);
    }
    console.warn("\nSet these in .env before running. Using placeholder tokens for now.\n");
  }

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

    // Get token from env or use placeholder
    const token = process.env[inglab.tokenEnvKey] || "REPLACE_WITH_ACTUAL_TOKEN";

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
        token,
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

    const tokenStatus = process.env[inglab.tokenEnvKey] ? "✅" : "⚠️  (placeholder)";
    console.log(`   ✅ Created DataSource: ${dataSourceId}`);
    console.log(`   📌 sourceClientId: ${inglab.sourceClientId} ${tokenStatus}`);
    migrated++;
  }

  console.log("\n" + "=".repeat(50));
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Not found: ${notFound}`);

  if (missingTokens.length > 0) {
    console.log(`\n⚠️  Action required: Set missing tokens in .env and re-run to update tokens.`);
  }

  if (migrated > 0) {
    console.log(`\n✅ Migration complete! ${migrated} DataSource(s) created.`);
  } else if (skipped > 0) {
    console.log(`\nℹ️  All customers already have INGLAB DataSources.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
});
