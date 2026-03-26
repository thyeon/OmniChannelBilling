/**
 * POST /api/invoices/generate/preview
 *
 * Preview an invoice using the generic billing service (generateBillableData).
 * Does NOT save anything — just returns the AutoCount payload for review.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateBillableData } from "@/domain/services/billingService";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";

interface PreviewRequest {
  customerId: string;
  billingMonth: string; // Format: "2026-03"
}

function isValidBillingMonth(month: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json();

    if (!body.customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!body.billingMonth || !isValidBillingMonth(body.billingMonth)) {
      return NextResponse.json(
        { error: "billingMonth must be in YYYY-MM format" },
        { status: 400 }
      );
    }

    const { customerId, billingMonth } = body;

    // 1. Fetch billable data using the generic billing service
    const billableResult = await generateBillableData(customerId, billingMonth);

    if (!billableResult.customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (billableResult.reason === "skipped") {
      return NextResponse.json(
        {
          error: `Billing skipped: customer is not active or billing cycle does not include ${billingMonth}`,
        },
        { status: 400 }
      );
    }

    const { customer, lineItems } = billableResult;

    // Filter out zero-count line items
    const activeLineItems = lineItems.filter((item) => item.billableCount > 0);

    if (activeLineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable data found for the specified billing month" },
        { status: 404 }
      );
    }

    // 2. Validate AutoCount configuration
    if (!customer.autocountAccountBookId || !customer.autocountDebtorCode) {
      return NextResponse.json(
        {
          error: "Customer is not configured for AutoCount billing (missing account book or debtor code)",
        },
        { status: 400 }
      );
    }

    // 3. Build AutoCount payload
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth,
      lineItems: activeLineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    const { master, details } = buildResult.payload;

    // 4. Format preview response
    const previewData = details.map((detail, index) => ({
      doc_no: `PREVIEW-${String(index + 1).padStart(3, "0")}`,
      doc_date: master.docDate,
      debtor_code: master.debtorCode,
      product_code: detail.productCode,
      detail_description: detail.description,
      further_description: detail.furtherDescription || "",
      qty: detail.qty,
      unit_price: detail.unitPrice,
      local_total_cost: detail.localTotalCost || detail.qty * detail.unitPrice,
    }));

    return NextResponse.json({
      period: billingMonth,
      billingMonth,
      customer: customer.name,
      customerId: customer.id,
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
