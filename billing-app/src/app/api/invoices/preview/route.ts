import { NextRequest, NextResponse } from "next/server";
import { findAllCustomers } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { fetchCowayBillableData } from "@/domain/services/cowayBillingService";

const COWAY_CUSTOMER_NAME = "Coway (Malaysia) Sdn Bhd";

interface PreviewRequest {
  billingMonth: string;
  customerId?: string;
}

function isValidBillingMonth(month: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json();

    if (!body.billingMonth || !isValidBillingMonth(body.billingMonth)) {
      return NextResponse.json(
        { error: "billingMonth must be in YYYY-MM format" },
        { status: 400 }
      );
    }

    const billingMonth = body.billingMonth;
    const customerName = COWAY_CUSTOMER_NAME;

    // Fetch customer
    const customers = await findAllCustomers();
    const customer = customers.find((c) => c.name === customerName) || null;

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Validate customer has AutoCount configuration
    if (!customer.autocountAccountBookId || !customer.autocountDebtorCode) {
      return NextResponse.json(
        { error: "Customer is not configured for AutoCount billing" },
        { status: 400 }
      );
    }

    // Fetch billable data
    const billableResult = await fetchCowayBillableData(billingMonth);

    if (!billableResult.customer) {
      return NextResponse.json(
        { error: "No billing data found for the specified billing month" },
        { status: 404 }
      );
    }

    // Filter out line items with zero billable count
    const lineItems = billableResult.lineItems.filter(
      (item) => item.billableCount > 0
    );

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable data found for the specified billing month" },
        { status: 404 }
      );
    }

    // Build AutoCount payload (same as generate but without calling API)
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth,
      lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    const { master, details } = buildResult.payload;

    // Format response matching /billing-export pattern
    const previewData = details.map((detail, index) => ({
      doc_no: `PREVIEW-${String(index + 1).padStart(3, "0")}`,
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
      period: billingMonth,
      customer: customerName,
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
