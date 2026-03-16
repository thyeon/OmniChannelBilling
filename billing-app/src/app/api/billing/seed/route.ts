import { NextResponse } from "next/server";
import { seedBillingDefaults } from "@/infrastructure/db/billingDefaultsRepository";
import { seedBillingClients } from "@/infrastructure/db/billingClientRepository";

// POST /api/billing/seed - Seed default data
export async function POST() {
  try {
    await seedBillingDefaults();
    await seedBillingClients();
    return NextResponse.json({ success: true, message: "Data seeded successfully" });
  } catch (error) {
    console.error("Error seeding data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to seed data", details: message },
      { status: 500 }
    );
  }
}
