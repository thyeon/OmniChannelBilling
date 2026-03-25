/**
 * DataSource Repository
 *
 * MongoDB CRUD operations for DataSource configuration.
 * Provides persistence for configurable billing data sources per customer.
 */

import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { DataSource, CreateDataSourceInput } from "@/domain/models/dataSource";

const COLLECTION_NAME = "dataSources";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to a DataSource. Uses the document's own `id` field. */
function toDataSource(doc: WithId<Document>): DataSource {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as DataSource;
}

/**
 * Create a new data source.
 * @param dataSource - The data source to create (without id, createdAt, updatedAt)
 * @returns The created data source with generated id
 */
export async function createDataSource(
  dataSource: CreateDataSourceInput
): Promise<DataSource> {
  const collection = await getCollection();
  const now = new Date();
  const id = `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const newDataSource: DataSource = {
    ...dataSource,
    id,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(newDataSource as unknown as Document);
  return newDataSource;
}

/**
 * Fetch all data sources for a customer.
 * @param customerId - The customer ID
 * @returns Array of data sources
 */
export async function findDataSourcesByCustomerId(
  customerId: string
): Promise<DataSource[]> {
  const collection = await getCollection();
  const docs = await collection.find({ customerId }).toArray();
  return docs.map(toDataSource);
}

/**
 * Fetch all active data sources for a customer.
 * @param customerId - The customer ID
 * @returns Array of active data sources
 */
export async function findActiveDataSourcesByCustomerId(
  customerId: string
): Promise<DataSource[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ customerId, isActive: true })
    .toArray();
  return docs.map(toDataSource);
}

/**
 * Fetch a single data source by id.
 * @param id - The data source ID
 * @returns The data source or null if not found
 */
export async function findDataSourceById(
  id: string
): Promise<DataSource | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toDataSource(doc);
}

/**
 * Update an existing data source by id.
 * @param id - The data source ID
 * @param updates - Partial data source fields to update
 * @returns The updated data source or null if not found
 */
export async function updateDataSource(
  id: string,
  updates: Partial<DataSource>
): Promise<DataSource | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toDataSource(result);
}

/**
 * Delete a data source by id.
 * @param id - The data source ID
 * @returns True if deleted, false if not found
 */
export async function deleteDataSource(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.deleteOne({ id });
  return result.deletedCount === 1;
}

/**
 * Set active status for data sources for a customer.
 * Deactivates any data sources not in the activeIds array.
 * @param customerId - The customer ID
 * @param activeIds - Array of data source IDs that should be active
 */
export async function setActiveDataSources(
  customerId: string,
  activeIds: string[]
): Promise<void> {
  const collection = await getCollection();

  // First, deactivate all data sources for this customer
  await collection.updateMany(
    { customerId },
    { $set: { isActive: false, updatedAt: new Date() } }
  );

  // Then activate only the specified ones
  if (activeIds.length > 0) {
    await collection.updateMany(
      { id: { $in: activeIds }, customerId },
      { $set: { isActive: true, updatedAt: new Date() } }
    );
  }
}
