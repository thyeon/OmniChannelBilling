import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";

interface RouteParams {
  params: { id: string };
}

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

    // Fetch customer
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Filter line items with billable count > 0
    const lineItems = invoice.lineItems.filter(
      (item) => item.billableCount > 0
    );

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable line items found" },
        { status: 404 }
      );
    }

    // Build AutoCount payload from stored line items
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth: invoice.billingMonth,
      lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    const { master, details } = buildResult.payload;

    // Format response matching existing preview format
    const previewData = details.map((detail, index) => ({
      doc_no: invoice.autocountRefId || `INV-${String(index + 1).padStart(3, "0")}`,
      doc_date: master.docDate,
      debtor_code: master.debtorCode,
      product_code: detail.productCode,
      detail_description: detail.description,
      further_description: detail.furtherDescription || "",
      qty: detail.qty,
      unit_price: detail.unitPrice,
      local_total_cost: detail.localTotalCost || (detail.qty * detail.unitPrice),
    }));

    return NextResponse.json({
      invoiceId: invoice.id,
      billingMonth: invoice.billingMonth,
      customer: invoice.customerName,
      total_rows: previewData.length,
      data: previewData,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
