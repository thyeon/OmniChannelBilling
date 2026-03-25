import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import {
  CustomerProductMapping,
  CustomerProductMappingInput,
  CustomerProductMappingUpdate,
} from "@/domain/models/customerProductMapping";

const COLLECTION_NAME = "customerProductMappings";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to a CustomerProductMapping. Uses the document's own `id` field. */
function toCustomerProductMapping(doc: WithId<Document>): CustomerProductMapping {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as CustomerProductMapping;
}

/** Create a new customer product mapping. */
export async function createCustomerProductMapping(
  input: CustomerProductMappingInput
): Promise<CustomerProductMapping> {
  const collection = await getCollection();
  const now = new Date();
  const id = `cpm-${Date.now()}`;
  const newMapping: CustomerProductMapping = {
    id,
    ...input,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await collection.insertOne(newMapping);
  return newMapping;
}

/** Find all customer product mappings for a given customerId. */
export async function findCustomerProductMappingsByCustomerId(
  customerId: string
): Promise<CustomerProductMapping[]> {
  const collection = await getCollection();
  const docs = await collection.find({ customerId }).toArray();
  return docs.map(toCustomerProductMapping);
}

/** Find a single customer product mapping by id. */
export async function findCustomerProductMappingById(
  id: string
): Promise<CustomerProductMapping | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toCustomerProductMapping(doc);
}

/** Find a single customer product mapping by compound key (customerId, serviceType, lineIdentifier). */
export async function findCustomerProductMappingByKey(
  customerId: string,
  serviceType: string,
  lineIdentifier: string
): Promise<CustomerProductMapping | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ customerId, serviceType, lineIdentifier });
  if (!doc) return null;
  return toCustomerProductMapping(doc);
}

/** Update a customer product mapping by id. */
export async function updateCustomerProductMapping(
  id: string,
  update: CustomerProductMappingUpdate
): Promise<CustomerProductMapping | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...update, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toCustomerProductMapping(result);
}

/** Delete a customer product mapping by id. */
export async function deleteCustomerProductMapping(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}