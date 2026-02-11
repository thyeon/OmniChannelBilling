/**
 * Migration Script: AutoCount Option C
 *
 * Creates default AutoCount Account Book and Service Product Mapping
 * based on existing credentials. Links existing customers with
 * autocountCustomerId to the default account book.
 *
 * Usage: npx ts-node --project tsconfig.json src/scripts/migrateAutoCount.ts
 *
 * This script is idempotent — safe to run multiple times.
 */

import { getDatabase } from "../infrastructure/db/mongodb";

const DEFAULT_ACCOUNT_BOOK = {
  id: "ac-default",
  name: "G-I Main Book",
  accountBookId: "4013",
  keyId: process.env.AUTOCOUNT_KEY_ID || "671f8a54-a239-4b7b-aed8-b0467c24fe2c",
  apiKey: process.env.AUTOCOUNT_API_KEY || "21157001-a521-4c3a-8500-7d5100f435c3",
  defaultCreditTerm: "Net 30 days",
  defaultSalesLocation: "HQ",
};

const DEFAULT_SMS_MAPPING = {
  id: "spm-default-sms",
  accountBookId: "ac-default",
  serviceType: "SMS",
  productCode: "SMS-Enhanced",
  description: "SMS Blast on ECS (Elastic Computing Service)",
  defaultUnitPrice: 0.079,
};

async function migrate(): Promise<void> {
  console.log("Starting AutoCount Option C migration...\n");

  const db = await getDatabase();

  // Step 1: Create default AutoCount Account Book (upsert)
  console.log("Step 1: Creating default AutoCount Account Book...");
  const accountBooksCollection = db.collection("autocountAccountBooks");
  const existingBook = await accountBooksCollection.findOne({ id: DEFAULT_ACCOUNT_BOOK.id });

  if (existingBook) {
    console.log("  Account book already exists, updating...");
    await accountBooksCollection.updateOne(
      { id: DEFAULT_ACCOUNT_BOOK.id },
      {
        $set: {
          ...DEFAULT_ACCOUNT_BOOK,
          updatedAt: new Date().toISOString(),
        },
      }
    );
  } else {
    console.log("  Creating new account book...");
    await accountBooksCollection.insertOne({
      ...DEFAULT_ACCOUNT_BOOK,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  console.log(`  Done: ${DEFAULT_ACCOUNT_BOOK.name} (${DEFAULT_ACCOUNT_BOOK.accountBookId})\n`);

  // Step 2: Create default SMS product mapping (upsert)
  console.log("Step 2: Creating default SMS product mapping...");
  const mappingsCollection = db.collection("serviceProductMappings");
  const existingMapping = await mappingsCollection.findOne({ id: DEFAULT_SMS_MAPPING.id });

  if (existingMapping) {
    console.log("  Mapping already exists, updating...");
    await mappingsCollection.updateOne(
      { id: DEFAULT_SMS_MAPPING.id },
      {
        $set: {
          ...DEFAULT_SMS_MAPPING,
          updatedAt: new Date().toISOString(),
        },
      }
    );
  } else {
    console.log("  Creating new mapping...");
    await mappingsCollection.insertOne({
      ...DEFAULT_SMS_MAPPING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  console.log(`  Done: ${DEFAULT_SMS_MAPPING.serviceType} → ${DEFAULT_SMS_MAPPING.productCode}\n`);

  // Step 3: Link existing customers with autocountCustomerId
  console.log("Step 3: Linking existing customers to default account book...");
  const customersCollection = db.collection("customers");

  // Find customers that have autocountCustomerId but no autocountAccountBookId
  const customersToLink = await customersCollection
    .find({
      autocountCustomerId: { $exists: true, $ne: "" },
      $or: [
        { autocountAccountBookId: { $exists: false } },
        { autocountAccountBookId: null },
        { autocountAccountBookId: "" },
      ],
    })
    .toArray();

  console.log(`  Found ${customersToLink.length} customer(s) to link.`);

  for (const customer of customersToLink) {
    // Map the old autocountCustomerId to the new autocountDebtorCode
    await customersCollection.updateOne(
      { id: customer.id },
      {
        $set: {
          autocountAccountBookId: DEFAULT_ACCOUNT_BOOK.id,
          autocountDebtorCode: customer.autocountCustomerId,
        },
      }
    );
    console.log(`  Linked: ${customer.name} → debtorCode: ${customer.autocountCustomerId}`);
  }

  console.log("\nMigration complete!");
  console.log("Summary:");
  console.log(`  - Account Book: ${DEFAULT_ACCOUNT_BOOK.name} (${DEFAULT_ACCOUNT_BOOK.accountBookId})`);
  console.log(`  - Product Mapping: ${DEFAULT_SMS_MAPPING.serviceType} → ${DEFAULT_SMS_MAPPING.productCode}`);
  console.log(`  - Customers linked: ${customersToLink.length}`);

  process.exit(0);
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
