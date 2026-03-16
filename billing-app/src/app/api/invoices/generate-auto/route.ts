/**
 * POST /api/invoices/generate-auto
 *
 * Generates an invoice in AutoCount for a specific customer and billing month.
 * Supports mock mode for testing without calling the real AutoCount API.
 */

import { NextRequest, NextResponse } from "next/server";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { insertInvoice, findInvoicesByCustomer } from "@/infrastructure/db/invoiceRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { createInvoice } from "@/infrastructure/external/autocountClient";
import { fetchCowayBillableData } from "@/domain/services/cowayBillingService";
import { InvoiceHistory, InvoiceStatus } from "@/types";
import { findAccountBookById } from "@/infrastructure/db/autoCountAccountBookRepository";

interface GenerateInvoiceRequest {
  customerId: string;
  billingMonth: string; // Format: "2026-03"
}

/**
 * Validate billing month format (YYYY-MM)
 */
function isValidBillingMonth(month: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}

/**
 * Check for duplicate invoice (INV-04)
 */
async function hasDuplicateInvoice(
  customerId: string,
  billingMonth: string
): Promise<boolean> {
  const invoices = await findInvoicesByCustomer(customerId);
  return invoices.some(
    (inv) =>
      inv.billingMonth === billingMonth &&
      (inv.status === "GENERATED" || inv.status === "SYNCED")
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate request body
    const body: GenerateInvoiceRequest = await request.json();

    if (!body.customerId) {
      return NextResponse.json(
        { success: false, error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!body.billingMonth || !isValidBillingMonth(body.billingMonth)) {
      return NextResponse.json(
        { success: false, error: "billingMonth must be in YYYY-MM format" },
        { status: 400 }
      );
    }

    const { customerId, billingMonth } = body;

    // 2. Fetch customer from MongoDB
    const customer = await findCustomerById(customerId);

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // 3. Validate customer has AutoCount configuration (INV-03)
    if (!customer.autocountAccountBookId || !customer.autocountDebtorCode) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Customer is not configured for AutoCount billing (missing account book or debtor code)",
        },
        { status: 400 }
      );
    }

    // 4. Check for duplicate invoice (INV-04)
    const isDuplicate = await hasDuplicateInvoice(customerId, billingMonth);
    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `Invoice already exists for customer ${customer.name} in ${billingMonth}`,
        },
        { status: 409 }
      );
    }

    // 5. Fetch billable data (INV-02)
    // For now, we use the Coway billing service - this can be extended
    const billableResult = await fetchCowayBillableData(billingMonth);

    if (!billableResult.customer) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch billable data: Customer not found" },
        { status: 500 }
      );
    }

    // Filter out line items with zero billable count
    const lineItems = billableResult.lineItems.filter(
      (item) => item.billableCount > 0
    );

    if (lineItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No billable data found for the specified billing month",
        },
        { status: 400 }
      );
    }

    // 6. Build AutoCount payload (INV-05)
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth,
      lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { success: false, error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    // 7. Create invoice in AutoCount (or mock) (INV-06)
    const isMockMode = process.env.AUTOCOUNT_MOCK === "true";
    let autoCountDocNo: string | undefined;
    let invoiceStatus: InvoiceStatus = "GENERATED";

    if (isMockMode) {
      // Mock mode: log payload and return fake success
      console.log("[MOCK MODE] Invoice payload:", JSON.stringify(buildResult.payload, null, 2));
      const timestamp = Date.now();
      autoCountDocNo = `MOCK-${timestamp}`;
      invoiceStatus = "DRAFT"; // Mock invoices are saved as DRAFT
      console.log(`[MOCK MODE] Generated mock invoice: ${autoCountDocNo}`);
    } else {
      // Real mode: fetch AutoCount credentials from account book
      const accountBook = await findAccountBookById(customer.autocountAccountBookId!);

      if (!accountBook) {
        return NextResponse.json(
          { success: false, error: "AutoCount account book not found" },
          { status: 500 }
        );
      }

      // Call AutoCount API
      const autoCountResult = await createInvoice(
        {
          accountBookId: accountBook.accountBookId,
          keyId: accountBook.keyId,
          apiKey: accountBook.apiKey,
        },
        buildResult.payload
      );

      if (!autoCountResult.success) {
        // Save invoice record with ERROR status
        const errorInvoice: InvoiceHistory = {
          id: "",
          customerId: customer.id,
          customerName: customer.name,
          billingMonth,
          totalAmount: lineItems.reduce((sum, li) => sum + li.totalCharge, 0),
          status: "ERROR",
          createdAt: new Date().toISOString(),
          billingMode: customer.billingMode || "MANUAL",
          lineItems,
          generatedBy: "MANUAL",
          syncError: autoCountResult.error,
        };

        await insertInvoice(errorInvoice);

        return NextResponse.json(
          { success: false, error: autoCountResult.error || "Failed to create invoice in AutoCount" },
          { status: 500 }
        );
      }

      autoCountDocNo = autoCountResult.docNo;
      invoiceStatus = "GENERATED";
    }

    // 8. Save invoice record to MongoDB (INV-07)
    const totalAmount = lineItems.reduce((sum, li) => sum + li.totalCharge, 0);

    const invoice: InvoiceHistory = {
      id: "", // Will be assigned by insertInvoice
      customerId: customer.id,
      customerName: customer.name,
      billingMonth,
      totalAmount,
      status: invoiceStatus,
      autocountRefId: autoCountDocNo,
      createdAt: new Date().toISOString(),
      billingMode: customer.billingMode || "MANUAL",
      schedule: customer.schedule,
      lineItems,
      generatedBy: "MANUAL",
    };

    const savedInvoice = await insertInvoice(invoice);

    // 9. Return success response
    return NextResponse.json({
      success: true,
      invoice: savedInvoice,
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
