import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { Customer } from "@/types";

const COLLECTION_NAME = "customers";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to a Customer. Uses the document's own `id` field. */
function toCustomer(doc: WithId<Document>): Customer {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as Customer;
}

/** Fetch all customers. */
export async function findAllCustomers(): Promise<Customer[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(toCustomer);
}

/** Fetch a single customer by id. */
export async function findCustomerById(id: string): Promise<Customer | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toCustomer(doc);
}

/** Insert or upsert a customer. Returns the customer with generated id if not provided. */
export async function insertCustomer(customer: Customer): Promise<Customer> {
  const collection = await getCollection();
  const now = new Date();
  const id = customer.id || `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const doc = { ...customer, id, updatedAt: now };
  await collection.updateOne(
    { id },
    { $set: doc, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  return doc;
}

/** Update an existing customer by id. Returns the updated customer or null. */
export async function updateCustomer(
  id: string,
  updates: Partial<Customer>
): Promise<Customer | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toCustomer(result);
}

/** Delete a customer by id. Returns true if deleted. */
export async function deleteCustomer(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}

/** Remove duplicate customers by name, keeping the most recently updated one. */
export async function deduplicateCustomers(): Promise<number> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();

  const byName = new Map<string, WithId<Document>[]>();
  for (const doc of docs) {
    const name = doc.name as string;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(doc);
  }

  let removed = 0;
  const entries = Array.from(byName.values());
  for (const group of entries) {
    if (group.length <= 1) continue;
    // Sort by updatedAt descending, keep the first (newest)
    group.sort((a: WithId<Document>, b: WithId<Document>) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt as string).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt as string).getTime() : 0;
      return bTime - aTime;
    });
    const toRemove = group.slice(1);
    for (const doc of toRemove) {
      await collection.deleteOne({ _id: doc._id });
      removed++;
    }
  }
  return removed;
}
