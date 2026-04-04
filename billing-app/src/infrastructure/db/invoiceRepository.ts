import { Collection, WithId, Document, ObjectId } from "mongodb";
import { getDatabase } from "./mongodb";
import { InvoiceHistory } from "@/types";

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
  let doc = null;
  if (ObjectId.isValid(id)) {
    doc = await collection.findOne({ _id: new ObjectId(id) });
  }
  if (!doc) {
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
  await collection.insertOne({
    ...invoice,
    createdAt: new Date(),
  });
  return invoice;
}

/** Update an existing invoice by id. Returns the updated invoice or null. */
export async function updateInvoice(
  id: string,
  updates: Partial<InvoiceHistory>
): Promise<InvoiceHistory | null> {
  const collection = await getCollection();
  const filter = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { id };
  const result = await collection.findOneAndUpdate(
    filter,
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toInvoice(result);
}
