import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { createInvoice } from "@/infrastructure/external/autocountClient";
import { findAccountBookById } from "@/infrastructure/db/autoCountAccountBookRepository";
import { updateInvoice } from "@/infrastructure/db/invoiceRepository";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/invoices/[id]/retry-sync
 *
 * Retry syncing a failed invoice to AutoCount.
 * Only works for invoices with ERROR status.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only allow retry for ERROR status
    if (invoice.status !== "ERROR") {
      return NextResponse.json(
        { error: "Can only retry sync for invoices with ERROR status" },
        { status: 400 }
      );
    }

    // Fetch customer
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Build AutoCount invoice payload
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth: invoice.billingMonth,
      lineItems: invoice.lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: buildResult.error || "Failed to build AutoCount invoice",
      });
      return NextResponse.json({
        success: false,
        error: buildResult.error || "Failed to build AutoCount invoice",
      });
    }

    // Get account book
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
      buildResult.payload
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
        docNo: syncResult.docNo,
      });
    } else {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: syncResult.error || "AutoCount API sync failed — please retry",
      });
      return NextResponse.json({
        success: false,
        error: syncResult.error || "AutoCount API sync failed — please retry",
      });
    }
  } catch (error) {
    console.error("Failed to retry invoice sync:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retry invoice sync" },
      { status: 500 }
    );
  }
}
