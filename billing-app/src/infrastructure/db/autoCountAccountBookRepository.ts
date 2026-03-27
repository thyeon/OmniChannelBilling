import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import {
  AutoCountAccountBook,
  AutoCountAccountBookInput,
  AutoCountAccountBookUpdate,
} from "@/domain/models/autoCountAccountBook";

const COLLECTION_NAME = "autocountAccountBooks";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to an AutoCountAccountBook. Uses the document's own `id` field. */
function toAutoCountAccountBook(doc: WithId<Document>): AutoCountAccountBook {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as AutoCountAccountBook;
}

/** Fetch all AutoCount account books. */
export async function findAllAccountBooks(): Promise<AutoCountAccountBook[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(toAutoCountAccountBook);
}

/** Fetch a single account book by internal id. */
export async function findAccountBookById(
  id: string
): Promise<AutoCountAccountBook | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toAutoCountAccountBook(doc);
}

/** Fetch a single account book by AutoCount's accountBookId field (for backward compat). */
export async function findAccountBookByAccountBookId(
  accountBookId: string
): Promise<AutoCountAccountBook | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ accountBookId });
  if (!doc) return null;
  return toAutoCountAccountBook(doc);
}

/** Insert a new account book. */
export async function insertAccountBook(
  accountBook: AutoCountAccountBookInput
): Promise<AutoCountAccountBook> {
  const collection = await getCollection();
  const now = new Date();
  const id = `ac-${Date.now()}`;
  const newAccountBook: AutoCountAccountBook = {
    id,
    ...accountBook,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await collection.insertOne(newAccountBook);
  return newAccountBook;
}

/** Update an existing account book by id. */
export async function updateAccountBook(
  id: string,
  updates: AutoCountAccountBookUpdate
): Promise<AutoCountAccountBook | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toAutoCountAccountBook(result);
}

/** Delete an account book by id. */
export async function deleteAccountBook(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}

/** Count customers linked to an account book. */
export async function countCustomersByAccountBook(
  accountBookId: string
): Promise<number> {
  const db = await getDatabase();
  const customerCollection = db.collection("customers");
  const count = await customerCollection.countDocuments({
    autocountAccountBookId: accountBookId,
  });
  return count;
}
