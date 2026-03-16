import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/billing";
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "billing";

async function updateCowayCustomer() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();

  const db = client.db(MONGODB_DB_NAME);
  const collection = db.collection("customers");

  const template = "For {BillingCycle}, the total number of International SMS messages sent via ECS Service was {SMSCount}, charged at RM {SMSRate} per message.";

  // Find Coway customer and update
  const result = await collection.updateOne(
    { name: "Coway (Malaysia) Sdn Bhd" },
    {
      $set: {
        furtherDescriptionSMSIntl: template,
        updatedAt: new Date()
      }
    }
  );

  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  if (result.matchedCount === 0) {
    console.log("Coway customer not found. Listing all customers:");
    const customers = await collection.find({}).toArray();
    customers.forEach(c => console.log(`  - ${c.name} (id: ${c.id})`));
  } else {
    console.log("Updated successfully!");
  }

  await client.close();
}

updateCowayCustomer().catch(console.error);
