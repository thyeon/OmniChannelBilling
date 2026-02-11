import { Collection, WithId, Document } from "mongodb";
import { getDatabase } from "./mongodb";
import { ScheduledJob } from "@/types";

const COLLECTION_NAME = "scheduledJobs";

async function getCollection(): Promise<Collection> {
  const db = await getDatabase();
  return db.collection(COLLECTION_NAME);
}

/** Converts a MongoDB document to a ScheduledJob, mapping _id to id. */
function toScheduledJob(doc: WithId<Document>): ScheduledJob {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    id: _id.toString(),
  } as ScheduledJob;
}

/** Fetch all scheduled jobs, sorted by scheduledAt descending. */
export async function findAllScheduledJobs(): Promise<ScheduledJob[]> {
  const collection = await getCollection();
  const docs = await collection.find({}).sort({ scheduledAt: -1 }).toArray();
  return docs.map(toScheduledJob);
}

/** Fetch scheduled jobs for a specific customer. */
export async function findScheduledJobsByCustomer(
  customerId: string
): Promise<ScheduledJob[]> {
  const collection = await getCollection();
  const docs = await collection
    .find({ customerId })
    .sort({ scheduledAt: -1 })
    .toArray();
  return docs.map(toScheduledJob);
}

/** Fetch a single scheduled job by id. */
export async function findScheduledJobById(
  id: string
): Promise<ScheduledJob | null> {
  const collection = await getCollection();
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return toScheduledJob(doc);
}

/** Insert a new scheduled job. Returns the inserted job. */
export async function insertScheduledJob(
  job: ScheduledJob
): Promise<ScheduledJob> {
  const collection = await getCollection();
  await collection.insertOne({
    ...job,
    createdAt: new Date(),
  });
  return job;
}

/** Update an existing scheduled job by id. Returns the updated job or null. */
export async function updateScheduledJob(
  id: string,
  updates: Partial<ScheduledJob>
): Promise<ScheduledJob | null> {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: "after" }
  );
  if (!result) return null;
  return toScheduledJob(result);
}

/** Fetch pending or retrying jobs that are due to fire. */
export async function findDueJobs(): Promise<ScheduledJob[]> {
  const collection = await getCollection();
  const now = new Date();
  const docs = await collection
    .find({
      $or: [
        { status: "PENDING", scheduledAt: { $lte: now.toISOString() } },
        { status: "RETRYING", nextRetryAt: { $lte: now.toISOString() } },
      ],
    })
    .toArray();
  return docs.map(toScheduledJob);
}
