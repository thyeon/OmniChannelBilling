import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/billing";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "billing";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

/** Returns a singleton MongoDB client and database connection. */
export async function getDatabase(): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }

  cachedDb = cachedClient.db(MONGODB_DB_NAME);
  return cachedDb;
}

/** Returns the raw MongoClient (for advanced use or graceful shutdown). */
export async function getClient(): Promise<MongoClient> {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGODB_URI);
    await cachedClient.connect();
  }
  return cachedClient;
}
