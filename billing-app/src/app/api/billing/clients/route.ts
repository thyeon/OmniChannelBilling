import { NextRequest, NextResponse } from "next/server";
import { findAllBillingClients, insertBillingClient } from "@/infrastructure/db/billingClientRepository";
import { BillingClient } from "@/domain/models/billingClient";

// GET /api/billing/clients - List all client mappings
export async function GET() {
  try {
    const clients = await findAllBillingClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching billing clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing clients" },
      { status: 500 }
    );
  }
}

// POST /api/billing/clients - Create new client mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_client_name, debtor_code, tax_entity, address } = body;

    if (!source_client_name || !debtor_code) {
      return NextResponse.json(
        { error: "source_client_name and debtor_code are required" },
        { status: 400 }
      );
    }

    const newClient: BillingClient = {
      id: `billing_client_${Date.now()}`,
      source_client_name,
      debtor_code,
      tax_entity: tax_entity || "",
      address: address || "",
      is_active: true,
    };

    const created = await insertBillingClient(newClient);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating billing client:", error);
    return NextResponse.json(
      { error: "Failed to create billing client" },
      { status: 500 }
    );
  }
}
