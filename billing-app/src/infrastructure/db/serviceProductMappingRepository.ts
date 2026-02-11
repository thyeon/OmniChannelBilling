import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import {
  ServiceProductMapping,
  ServiceProductMappingInput,
  ServiceProductMappingUpdate,
} from "@/domain/models/serviceProductMapping";

const COLLECTION_NAME = "serviceProductMappings";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to a ServiceProductMapping. Uses the document's own `id` field. */
function toServiceProductMapping(
  doc: WithId<Document>
): ServiceProductMapping {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as ServiceProductMapping;
}

/** Fetch all service product mappings. */
export async function findAllServiceProductMappings(): Promise<
  ServiceProductMapping[]
> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(toServiceProductMapping);
}

/** Fetch all mappings for a specific account book. */
export async function findMappingsByAccountBook(
  accountBookId: string
): Promise<ServiceProductMapping[]> {
  const collection = await getCollection();
  const docs = await collection.find({ accountBookId }).toArray();
  return docs.map(toServiceProductMapping);
}

/** Fetch a single mapping by id. */
export async function findServiceProductMappingById(
  id: string
): Promise<ServiceProductMapping | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toServiceProductMapping(doc);
}

/** Find a mapping by account book and service type. */
export async function findMappingByAccountBookAndService(
  accountBookId: string,
  serviceType: string
): Promise<ServiceProductMapping | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ accountBookId, serviceType });
  if (!doc) return null;
  return toServiceProductMapping(doc);
}

/** Insert a new service product mapping. */
export async function insertServiceProductMapping(
  mapping: ServiceProductMappingInput
): Promise<ServiceProductMapping> {
  const collection = await getCollection();
  const now = new Date();
  const id = `spm-${Date.now()}`;
  const newMapping: ServiceProductMapping = {
    id,
    ...mapping,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await collection.insertOne(newMapping);
  return newMapping;
}

/** Update an existing mapping by id. */
export async function updateServiceProductMapping(
  id: string,
  updates: ServiceProductMappingUpdate
): Promise<ServiceProductMapping | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toServiceProductMapping(result);
}

/** Delete a mapping by id. */
export async function deleteServiceProductMapping(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}
