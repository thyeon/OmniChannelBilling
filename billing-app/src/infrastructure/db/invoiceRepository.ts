import { Collection, WithId, Document, ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";
import { InvoiceHistory } from "@/types";
import { randomUUID } from "crypto";

const COLLECTION_NAME = "invoices";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to an InvoiceHistory, mapping _id to id. */
function toInvoice(doc: WithId<Document>): InvoiceHistory {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: _id.toString(),
  } as InvoiceHistory;
}

/** Fetch all invoices, sorted by createdAt descending. */
export async function findAllInvoices(): Promise<InvoiceHistory[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(toInvoice);
}

/** Fetch invoices for a specific customer. */
export async function findInvoicesByCustomer(
  customerId: string
): Promise<InvoiceHistory[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ customerId })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map(toInvoice);
}

/** Fetch a single invoice by id (tries MongoDB _id first, then document id field). */
export async function findInvoiceById(
  id: string
): Promise<InvoiceHistory | null> {
  const collection = await getCollection();
  // Don't search for empty id - this would match the first invoice with empty id
  if (!id) return null;

  let doc = null;
  if (ObjectId.isValid(id)) {
    doc = await collection.findOne({ _id: new ObjectId(id) });
  }
  if (!doc && id) {
    doc = await collection.findOne({ id });
  }
  if (!doc) return null;
  return toInvoice(doc);
}

/** Insert a new invoice. Returns the inserted invoice. */
export async function insertInvoice(
  invoice: InvoiceHistory
): Promise<InvoiceHistory> {
  const collection = await getCollection();
  // Generate a unique ID if not provided
  const uniqueId = invoice.id || randomUUID();
  await collection.insertOne({
    ...invoice,
    id: uniqueId,
    createdAt: new Date(),
  });
  return { ...invoice, id: uniqueId };
}

/** Update an existing invoice by id. Returns the updated invoice or null. */
export async function updateInvoice(
  id: string,
  updates: Partial<InvoiceHistory>
): Promise<InvoiceHistory | null> {
  const collection = await getCollection();

  // Build query - prefer MongoDB _id if valid ObjectId, fallback to id field
  let query: Document;
  if (ObjectId.isValid(id)) {
    query = { _id: new ObjectId(id) };
  } else {
    // Only use id field if it's not empty
    if (!id) return null;
    query = { id };
  }

  const result = await collection.findOneAndUpdate(
    query,
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toInvoice(result);
}
