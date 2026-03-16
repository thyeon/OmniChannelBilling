import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { updateInvoice } from "@/infrastructure/db/invoiceRepository";

interface RouteParams {
  params: { id: string };
}

// GET /api/invoices/[id]/payload
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // If custom payload exists, return it
    if (invoice.customPayload) {
      return NextResponse.json({
        invoiceId: invoice.id,
        billingMonth: invoice.billingMonth,
        customerName: invoice.customerName,
        payload: JSON.parse(invoice.customPayload),
        hasCustomPayload: true,
      });
    }

    // Build payload from stored line items
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth: invoice.billingMonth,
      lineItems: invoice.lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      billingMonth: invoice.billingMonth,
      customerName: invoice.customerName,
      payload: buildResult.payload,
      hasCustomPayload: false,
    });
  } catch (error) {
    console.error("Error getting payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/[id]/payload
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.payload) {
      return NextResponse.json(
        { error: "payload is required" },
        { status: 400 }
      );
    }

    // Validate payload is valid JSON
    let payloadString: string;
    try {
      payloadString = typeof body.payload === 'string'
        ? body.payload
        : JSON.stringify(body.payload, null, 2);
    } catch {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 }
      );
    }

    // Save custom payload to invoice
    await updateInvoice(invoice.id, {
      customPayload: payloadString,
    });

    return NextResponse.json({
      success: true,
      message: "Custom payload saved",
    });
  } catch (error) {
    console.error("Error saving payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
