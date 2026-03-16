import { NextRequest, NextResponse } from "next/server";
import { findBillingClientById, updateBillingClient, deleteBillingClient } from "@/infrastructure/db/billingClientRepository";

// GET /api/billing/clients/[id] - Get client by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await findBillingClientById(id);

    if (!client) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching billing client:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing client" },
      { status: 500 }
    );
  }
}

// PUT /api/billing/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateBillingClient(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating billing client:", error);
    return NextResponse.json(
      { error: "Failed to update billing client" },
      { status: 500 }
    );
  }
}

// DELETE /api/billing/clients/[id] - Soft delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteBillingClient(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting billing client:", error);
    return NextResponse.json(
      { error: "Failed to delete billing client" },
      { status: 500 }
    );
  }
}
