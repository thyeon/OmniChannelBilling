import { NextRequest, NextResponse } from "next/server";
import {
  findServiceProductMappingById,
  updateServiceProductMapping,
  deleteServiceProductMapping,
} from "@/infrastructure/db/serviceProductMappingRepository";

interface RouteParams {
  params: { id: string };
}

/** GET /api/autocount/product-mappings/[id] — Fetch a single mapping. */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const mapping = await findServiceProductMappingById(params.id);
    if (!mapping) {
      return NextResponse.json({ error: "Product mapping not found" }, { status: 404 });
    }
    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("Failed to fetch product mapping:", error);
    return NextResponse.json(
      { error: "Failed to fetch product mapping" },
      { status: 500 }
    );
  }
}

/** PUT /api/autocount/product-mappings/[id] — Update a product mapping. */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { productCode, description, defaultUnitPrice, defaultBillingMode, taxCode, invoiceDescriptionTemplate, furtherDescriptionTemplate } = body;

    const mapping = await updateServiceProductMapping(params.id, {
      productCode,
      description,
      defaultUnitPrice,
      defaultBillingMode,
      taxCode,
      invoiceDescriptionTemplate,
      furtherDescriptionTemplate,
    });

    if (!mapping) {
      return NextResponse.json({ error: "Product mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("Failed to update product mapping:", error);
    return NextResponse.json(
      { error: "Failed to update product mapping" },
      { status: 500 }
    );
  }
}

/** DELETE /api/autocount/product-mappings/[id] — Delete a product mapping. */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const deleted = await deleteServiceProductMapping(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Product mapping not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete product mapping" },
      { status: 500 }
    );
  }
}
