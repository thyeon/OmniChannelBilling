import { NextRequest, NextResponse } from "next/server";
import {
  findAllServiceProductMappings,
  findMappingsByAccountBook,
  insertServiceProductMapping,
} from "@/infrastructure/db/serviceProductMappingRepository";

/** GET /api/autocount/product-mappings — Fetch all or filtered mappings. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const accountBookId = searchParams.get("accountBookId");

    const mappings = accountBookId
      ? await findMappingsByAccountBook(accountBookId)
      : await findAllServiceProductMappings();

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Failed to fetch product mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch product mappings" },
      { status: 500 }
    );
  }
}

/** POST /api/autocount/product-mappings — Create a new product mapping. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { accountBookId, serviceType, productCode, description, defaultUnitPrice, defaultBillingMode, taxCode, invoiceDescriptionTemplate, furtherDescriptionTemplate } = body;

    // Validation
    if (!accountBookId || !serviceType || !productCode) {
      return NextResponse.json(
        { error: "accountBookId, serviceType, and productCode are required" },
        { status: 400 }
      );
    }

    // Check for duplicate
    const { findMappingByAccountBookAndService } = await import(
      "@/infrastructure/db/serviceProductMappingRepository"
    );
    const existing = await findMappingByAccountBookAndService(accountBookId, serviceType);
    if (existing) {
      return NextResponse.json(
        { error: "Mapping for this service type already exists in this account book" },
        { status: 400 }
      );
    }

    const mapping = await insertServiceProductMapping({
      accountBookId,
      serviceType,
      productCode,
      description,
      defaultUnitPrice,
      defaultBillingMode,
      taxCode,
      invoiceDescriptionTemplate,
      furtherDescriptionTemplate,
    });

    return NextResponse.json({ mapping }, { status: 201 });
  } catch (error) {
    console.error("Failed to create product mapping:", error);
    return NextResponse.json(
      { error: "Failed to create product mapping" },
      { status: 500 }
    );
  }
}
