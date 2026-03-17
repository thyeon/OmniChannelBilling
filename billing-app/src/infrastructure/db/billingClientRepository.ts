import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { BillingClient } from "@/domain/models/billingClient";

const COLLECTION_NAME = "billing_clients";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

function toBillingClient(doc: WithId<Document>): BillingClient {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: (rest.id as string) || _id.toString(),
  } as BillingClient;
}

/** Fetch all active billing clients. */
export async function findAllBillingClients(): Promise<BillingClient[]> {
  const collection = await getCollection();
  const docs = await collection.find({ is_active: true }).toArray();
  return docs.map(toBillingClient);
}

/** Fetch all billing clients (including inactive). */
export async function findAllBillingClientsIncludingInactive(): Promise<BillingClient[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(toBillingClient);
}

/** Fetch a single billing client by id. */
export async function findBillingClientById(id: string): Promise<BillingClient | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toBillingClient(doc);
}

/** Fetch a billing client by source client name. */
export async function findBillingClientBySourceName(sourceClientName: string): Promise<BillingClient | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ source_client_name: sourceClientName, is_active: true });
  if (!doc) return null;
  return toBillingClient(doc);
}

/** Fetch a billing client by debtor code. */
export async function findBillingClientByDebtorCode(debtorCode: string): Promise<BillingClient | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ debtor_code: debtorCode, is_active: true });
  if (!doc) return null;
  return toBillingClient(doc);
}

/** Insert a new billing client. */
export async function insertBillingClient(client: BillingClient): Promise<BillingClient> {
  const collection = await getCollection();
  const now = new Date();
  await collection.updateOne(
    { id: client.id },
    {
      $set: { ...client, updated_at: now },
      $setOnInsert: { created_at: now },
    },
    { upsert: true }
  );
  return client;
}

/** Update an existing billing client by id. */
export async function updateBillingClient(
  id: string,
  updates: Partial<BillingClient>
): Promise<BillingClient | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { ...updates, updated_at: new Date() } },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toBillingClient(result);
}

/** Soft delete a billing client (set is_active to false). */
export async function deleteBillingClient(id: string): Promise<boolean> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: { is_active: false, updated_at: new Date() } },
    { returnDocument: "after" }
  );
  return result !== null;
}

/** Seed default client mappings. */
export async function seedBillingClients(): Promise<void> {
  const defaultClients: Omit<BillingClient, "id" | "created_at" | "updated_at">[] = [
    {
      source_client_name: "AIA Malaysia",
      debtor_code: "300-0001",
      tax_entity: "TIN:C20395547010",
      address: "Level 19 Menara AIA 99 Jalan Ampang 50450 Kuala Lumpur Malaysia",
      is_active: true,
    },
    {
      source_client_name: "Zurich Malaysia",
      debtor_code: "300-H002",
      tax_entity: "TIN:C25196213100",
      address: "Level 23A Mercu 3 Jalan Bangsar KL Eco City 59200 Kuala Lumpur",
      is_active: true,
    },
    {
      source_client_name: "FWD Takaful",
      debtor_code: "300-F001",
      tax_entity: "TIN:C12166642050",
      address: "Level 21, Mercu 2, No. 3, KL Eco City, Jalan Bangsar, 59200 Kuala Lumpur.",
      is_active: true,
    },
    {
      source_client_name: "Prudential Malaysia",
      debtor_code: "300-H003",
      tax_entity: "TIN:C2899590020",
      address: "Level 20, Menara Prudential, Persiaran TRX Barat, Tun Razak Exchange, 55188 Kuala Lumpur.",
      is_active: true,
    },
    {
      source_client_name: "Pizza Hut",
      debtor_code: "300-P001",
      tax_entity: "TIN:C3855039030",
      address: "Level 13A Tower 1, VSquare @ PJ City Centre, Jalan Utara, 46200 Petaling Jaya, Selangor, Malaysia.",
      is_active: true,
    },
    {
      source_client_name: "Coway (Malaysia) Sdn Bhd",
      debtor_code: "300-C001",
      tax_entity: "TIN:C12113374050",
      address: "Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur",
      tax_code: "SV-6",  // Coway uses SV-6 instead of default SV-8
      is_active: true,
    },
  ];

  for (let i = 0; i < defaultClients.length; i++) {
    const client = defaultClients[i];
    const now = new Date();
    const collection = await getCollection();
    await collection.updateOne(
      { source_client_name: client.source_client_name },
      {
        $set: { ...client, updated_at: now },
        $setOnInsert: { id: `billing_client_${i + 1}`, created_at: now },
      },
      { upsert: true }
    );
  }
}
