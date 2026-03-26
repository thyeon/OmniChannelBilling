/**
 * POST /api/invoices/generate/generic
 *
 * Generate a billable invoice for any customer using the generic billing service.
 * Flow: generateBillableData → buildAutoCountInvoice → save → sync to AutoCount.
 * Runs in MOCK_MODE only (saves as DRAFT, logs payload — no real AutoCount API calls).
 */

import { NextRequest, NextResponse } from "next/server";
import { generateBillableData } from "@/domain/services/billingService";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { insertInvoice, updateInvoice } from "@/infrastructure/db/invoiceRepository";
import { InvoiceHistory, InvoiceStatus } from "@/types";

const MOCK_MODE = process.env.AUTOCOUNT_MOCK_MODE !== "false";

interface GenerateRequest {
  customerId: string;
  billingMonth: string; // Format: "2026-03"
}

function isValidBillingMonth(month: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
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

    const totalAmount = activeLineItems.reduce((sum, item) => sum + item.totalCharge, 0);

    // 3. Save invoice with GENERATED/DRAFT status to MongoDB
    const invoice: InvoiceHistory = {
      id: `inv-${Date.now()}`,
      customerId,
      customerName: customer.name,
      billingMonth,
      totalAmount,
      status: "GENERATED" as InvoiceStatus,
      createdAt: new Date().toISOString(),
      billingMode: customer.billingMode,
      schedule: customer.schedule,
      generatedBy: "MANUAL",
      lineItems: activeLineItems,
    };

    await insertInvoice(invoice);

    // 4. Build AutoCount invoice payload
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth,
      lineItems: activeLineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: buildResult.error || "Failed to build AutoCount invoice",
      });
      invoice.status = "ERROR";
      invoice.syncError = buildResult.error || "Failed to build AutoCount invoice";
      return NextResponse.json({ invoice });
    }

    // 5. In MOCK_MODE: log the payload and mark as DRAFT (no real AutoCount API call)
    if (MOCK_MODE) {
      const payloadLog = {
        invoiceId: invoice.id,
        customerId,
        customerName: customer.name,
        billingMonth,
        generatedAt: new Date().toISOString(),
        payload: buildResult.payload,
      };

      const fs = await import("fs/promises");
      const path = await import("path");
      const logDir = path.join(process.cwd(), "logs");
      await fs.mkdir(logDir, { recursive: true });
      await fs.appendFile(
        path.join(logDir, "generic-mock-invoices.log"),
        JSON.stringify(payloadLog, null, 2) + "\n"
      );

      await updateInvoice(invoice.id, { status: "DRAFT" });
      invoice.status = "DRAFT";

      return NextResponse.json({
        invoice: {
          ...invoice,
          status: "DRAFT",
          note: "Mock mode — invoice saved as DRAFT. Check logs/generic-mock-invoices.log for payload.",
        },
      });
    }

    // TODO: Real AutoCount API call when not in mock mode
    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
