import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { BillingExportHistory } from "@/domain/models/billingExportHistory";

const COLLECTION_NAME = "billing_export_history";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

function toBillingExportHistory(doc: WithId<Document>): BillingExportHistory {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as BillingExportHistory;
}

/** Fetch all export history records, sorted by exported_at descending. */
export async function findAllExportHistory(): Promise<BillingExportHistory[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({})
    .sort({ exported_at: -1 })
    .toArray();
  return docs.map(toBillingExportHistory);
}

/** Fetch export history by period. */
export async function findExportHistoryByPeriod(period: string): Promise<BillingExportHistory[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ period })
    .sort({ exported_at: -1 })
    .toArray();
  return docs.map(toBillingExportHistory);
}

/** Fetch export history by client name. */
export async function findExportHistoryByClient(clientName: string): Promise<BillingExportHistory[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ client_name: clientName })
    .sort({ exported_at: -1 })
    .toArray();
  return docs.map(toBillingExportHistory);
}

/** Insert a new export history record. */
export async function insertExportHistory(
  history: BillingExportHistory
): Promise<BillingExportHistory> {
  const collection = await getCollection();
  const now = new Date();
  const result = await collection.insertOne({
    ...history,
    exported_at: now,
  });
  return {
    ...history,
    id: result.insertedId.toString(),
    exported_at: now,
  };
}

/** Update an export history record. */
export async function updateExportHistory(
  id: string,
  updates: Partial<BillingExportHistory>
): Promise<BillingExportHistory | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toBillingExportHistory(result);
}
