import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { createInvoice } from "@/infrastructure/external/autocountClient";
import { findAccountBookById } from "@/infrastructure/db/autoCountAccountBookRepository";
import { updateInvoice } from "@/infrastructure/db/invoiceRepository";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface RouteParams {
  params: { id: string };
}

interface SubmitRequest {
  useCustomPayload?: boolean;
}

function logToFile(filename: string, content: string): void {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const filepath = join(logsDir, filename);
  writeFileSync(filepath, content, { flag: "a" });
}

export async function POST(
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

    // Only allow submit for DRAFT status
    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only submit invoices with DRAFT status" },
        { status: 400 }
      );
    }

    const body: SubmitRequest = await request.json();
    const useCustomPayload = body.useCustomPayload ?? false;
    // Submit always uses real AutoCount (not mock) for production billing
    const isMockMode = false;

    // Fetch customer
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Determine which payload to use
    let payload;

    if (useCustomPayload && invoice.customPayload) {
      try {
        payload = JSON.parse(invoice.customPayload);
      } catch {
        await updateInvoice(invoice.id, {
          status: "ERROR",
          syncError: "Invalid custom payload JSON",
        });
        return NextResponse.json({
          success: false,
          status: "ERROR",
          error: "Invalid custom payload JSON",
        });
      }
    } else {
      // Build payload from line items
      const buildResult = await buildAutoCountInvoice({
        customer,
        billingMonth: invoice.billingMonth,
        lineItems: invoice.lineItems,
      });

      if (!buildResult.success || !buildResult.payload) {
        await updateInvoice(invoice.id, {
          status: "ERROR",
          syncError: buildResult.error || "Failed to build invoice payload",
        });
        return NextResponse.json({
          success: false,
          status: "ERROR",
          error: buildResult.error || "Failed to build invoice payload",
        });
      }

      payload = buildResult.payload;
    }

    // Mock mode: log payload and return fake success
    if (isMockMode) {
      const timestamp = Date.now();
      const logEntry = `[${new Date().toISOString()}] SUBMIT INVOICE: ${timestamp}\n${JSON.stringify(payload, null, 2)}\n`;
      logToFile("autocount-mock-invoices.log", logEntry);
      console.log(`[MOCK MODE] Invoice logged to logs/autocount-mock-invoices.log`);

      const mockDocNo = `MOCK-${timestamp}`;

      await updateInvoice(invoice.id, {
        status: "SYNCED",
        autocountRefId: mockDocNo,
        syncError: undefined,
      });

      return NextResponse.json({
        success: true,
        status: "SYNCED",
        docNo: mockDocNo,
        isMock: true,
      });
    }

    // Real mode: get account book and call AutoCount API
    const accountBook = await findAccountBookById(customer.autocountAccountBookId!);
    if (!accountBook) {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: "AutoCount account book not found",
      });
      return NextResponse.json({
        success: false,
        error: "AutoCount account book not found",
      });
    }

    // Call AutoCount API
    const syncResult = await createInvoice(
      {
        accountBookId: accountBook.accountBookId,
        keyId: accountBook.keyId,
        apiKey: accountBook.apiKey,
      },
      payload
    );

    // Update status based on sync result
    if (syncResult.success && syncResult.docNo) {
      await updateInvoice(invoice.id, {
        status: "SYNCED",
        autocountRefId: syncResult.docNo,
        syncError: undefined,
      });
      return NextResponse.json({
        success: true,
        status: "SYNCED",
        docNo: syncResult.docNo,
      });
    } else {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: syncResult.error || "AutoCount API sync failed",
      });
      return NextResponse.json({
        success: false,
        status: "ERROR",
        error: syncResult.error || "AutoCount API sync failed",
      });
    }
  } catch (error) {
    console.error("Failed to submit invoice:", error);

    // Try to update invoice status to ERROR
    try {
      await updateInvoice(params.id, {
        status: "ERROR",
        syncError: error instanceof Error ? error.message : "Unknown error",
      });
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { success: false, error: "Failed to submit invoice" },
      { status: 500 }
    );
  }
}
