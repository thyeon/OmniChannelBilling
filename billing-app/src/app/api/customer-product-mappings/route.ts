import { NextRequest, NextResponse } from "next/server";
import {
  CustomerProductMappingInput,
  CustomerProductMappingUpdate,
} from "@/domain/models/customerProductMapping";
import {
  findCustomerProductMappingsByCustomerId,
  createCustomerProductMapping,
} from "@/infrastructure/db/customerProductMappingRepository";

/**
 * GET /api/customer-product-mappings — Fetch mappings by customerId
 * Query param: customerId (required)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId query parameter is required" },
        { status: 400 }
      );
    }

    const mappings = await findCustomerProductMappingsByCustomerId(customerId);
    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to fetch customer product mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer product mappings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customer-product-mappings — Create a new mapping
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "customerId",
      "serviceType",
      "lineIdentifier",
      "productCode",
      "description",
      "furtherDescriptionTemplate",
      "classificationCode",
      "unit",
      "taxCode",
      "billingMode",
      "defaultUnitPrice",
    ];

    const missingFields = requiredFields.filter((field) => !(field in body));

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const input: CustomerProductMappingInput = body;
    const created = await createCustomerProductMapping(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create customer product mapping:", error);
    return NextResponse.json(
      { error: "Failed to create customer product mapping" },
      { status: 500 }
    );
  }
}