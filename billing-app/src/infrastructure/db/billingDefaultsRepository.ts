import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { BillingDefault } from "@/domain/models/billingDefaults";

const COLLECTION_NAME = "billing_defaults";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

function toBillingDefault(doc: WithId<Document>): BillingDefault {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as BillingDefault;
}

/** Fetch all billing defaults. */
export async function findAllBillingDefaults(): Promise<BillingDefault[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(toBillingDefault);
}

/** Fetch a single billing default by field name. */
export async function findBillingDefaultByFieldName(fieldName: string): Promise<BillingDefault | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ field_name: fieldName });
  if (!doc) return null;
  return toBillingDefault(doc);
}

/** Insert or update a billing default. */
export async function upsertBillingDefault(
  fieldName: string,
  fieldValue: string,
  isSystem: boolean = false
): Promise<BillingDefault> {
  const collection = await getCollection();
  const now = new Date();
  await collection.updateOne(
    { field_name: fieldName },
    {
      $set: { field_value: fieldValue, is_system: isSystem, updated_at: now },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  );
  return {
    field_name: fieldName,
    field_value: fieldValue,
    is_system: isSystem,
  };
}

/** Update a billing default by field name. */
export async function updateBillingDefault(
  fieldName: string,
  fieldValue: string
): Promise<BillingDefault | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { field_name: fieldName },
    { $set: { field_value: fieldValue, updated_at: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toBillingDefault(result);
}

/** Seed default values if they don't exist. */
export async function seedBillingDefaults(): Promise<void> {
  const defaults = [
    { field_name: "sales_location", field_value: "HQ", is_system: false },
    { field_name: "sales_agent", field_value: "Darren Lim", is_system: false },
    { field_name: "credit_term", field_value: "Net 30 days", is_system: false },
    { field_name: "product_code", field_value: "MODE-WA-API", is_system: false },
    { field_name: "acc_no", field_value: "500-0000", is_system: false },
    { field_name: "classification_code", field_value: "'022", is_system: false },
    { field_name: "tax_code", field_value: "SV-8", is_system: false },
    { field_name: "inclusive_tax", field_value: "FALSE", is_system: false },
    { field_name: "submit_e_invoice", field_value: "FALSE", is_system: false },
  ];

  for (const def of defaults) {
    await upsertBillingDefault(def.field_name, def.field_value, def.is_system);
  }
}
