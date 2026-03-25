import { NextRequest, NextResponse } from "next/server";
import {
  CustomerProductMappingUpdate,
} from "@/domain/models/customerProductMapping";
import {
  findCustomerProductMappingById,
  updateCustomerProductMapping,
  deleteCustomerProductMapping,
} from "@/infrastructure/db/customerProductMappingRepository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customer-product-mappings/[id] — Fetch a mapping by id
 */
export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const mapping = await findCustomerProductMappingById(id);

    if (!mapping) {
      return NextResponse.json(
        { error: "Customer product mapping not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Failed to fetch customer product mapping:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer product mapping" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/customer-product-mappings/[id] — Update a mapping
 */
export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();

    const update: CustomerProductMappingUpdate = body;
    const updated = await updateCustomerProductMapping(id, update);

    if (!updated) {
      return NextResponse.json(
        { error: "Customer product mapping not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update customer product mapping:", error);
    return NextResponse.json(
      { error: "Failed to update customer product mapping" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/customer-product-mappings/[id] — Delete a mapping
 */
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { id } = await params;
    const deleted = await deleteCustomerProductMapping(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Customer product mapping not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer product mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete customer product mapping" },
      { status: 500 }
    );
  }
}