import { NextRequest, NextResponse } from "next/server";
import { findAllBillingDefaults, updateBillingDefault, seedBillingDefaults } from "@/infrastructure/db/billingDefaultsRepository";

// GET /api/billing/defaults - Get all default field values
export async function GET() {
  try {
    // Seed defaults if they don't exist
    await seedBillingDefaults();

    const defaults = await findAllBillingDefaults();
    return NextResponse.json(defaults);
  } catch (error) {
    console.error("Error fetching billing defaults:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing defaults" },
      { status: 500 }
    );
  }
}

// PUT /api/billing/defaults - Update default values
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { field_name, field_value } = body;

    if (!field_name || field_value === undefined) {
      return NextResponse.json(
        { error: "field_name and field_value are required" },
        { status: 400 }
      );
    }

    // Check if field is a system field (read-only)
    const existing = await findAllBillingDefaults();
    const systemField = existing.find(d => d.field_name === field_name && d.is_system);

    if (systemField) {
      return NextResponse.json(
        { error: "Cannot modify system field" },
        { status: 403 }
      );
    }

    const updated = await updateBillingDefault(field_name, field_value);

    if (!updated) {
      return NextResponse.json(
        { error: "Default not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating billing default:", error);
    return NextResponse.json(
      { error: "Failed to update billing default" },
      { status: 500 }
    );
  }
}
