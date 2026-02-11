import { NextRequest, NextResponse } from "next/server";
import { InvoiceHistory, InvoiceStatus, InvoiceLineItem } from "@/types";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import {
  insertInvoice,
  updateInvoice,
  findAllInvoices,
} from "@/infrastructure/db/invoiceRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { createInvoice } from "@/infrastructure/external/autocountClient";
import { findAccountBookById } from "@/infrastructure/db/autoCountAccountBookRepository";

interface GenerateInvoiceBody {
  customerId: string;
  billingMonth: string;
  lineItems: InvoiceLineItem[];
  generatedBy?: "MANUAL" | "SCHEDULED";
  scheduledJobId?: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const invoices = await findAllInvoices();
    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Failed to fetch invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: GenerateInvoiceBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { customerId, billingMonth, lineItems, generatedBy, scheduledJobId } = body;

  if (!customerId || !billingMonth || !lineItems?.length) {
    return NextResponse.json(
      { error: "customerId, billingMonth, and lineItems are required" },
      { status: 400 }
    );
  }

  // Fetch customer from DB for name and billing mode
  const customer = await findCustomerById(customerId);
  if (!customer) {
    return NextResponse.json(
      { error: "Customer not found" },
      { status: 404 }
    );
  }

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + item.totalCharge,
    0
  );

  // Step A: Save invoice with GENERATED status to MongoDB
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
    generatedBy: generatedBy ?? "MANUAL",
    scheduledJobId,
    lineItems,
  };

  await insertInvoice(invoice);

  // Step B: Build AutoCount invoice payload
  console.log(`Building AutoCount invoice for: ${customer.name}`);
  const buildResult = await buildAutoCountInvoice({
    customer,
    billingMonth,
    lineItems,
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

  // Step C: Call AutoCount API
  const accountBook = await findAccountBookById(customer.autocountAccountBookId!);
  if (!accountBook) {
    await updateInvoice(invoice.id, {
      status: "ERROR",
      syncError: "AutoCount account book not found",
    });
    invoice.status = "ERROR";
    invoice.syncError = "AutoCount account book not found";
    return NextResponse.json({ invoice });
  }

  console.log(`Syncing invoice to AutoCount (account book: ${accountBook.accountBookId})`);
  const syncResult = await createInvoice(
    {
      accountBookId: accountBook.accountBookId,
      keyId: accountBook.keyId,
      apiKey: accountBook.apiKey,
    },
    buildResult.payload
  );

  // Step D: Update status based on sync result
  if (syncResult.success && syncResult.docNo) {
    await updateInvoice(invoice.id, {
      status: "SYNCED",
      autocountRefId: syncResult.docNo,
    });
    invoice.status = "SYNCED";
    invoice.autocountRefId = syncResult.docNo;
  } else {
    await updateInvoice(invoice.id, {
      status: "ERROR",
      syncError: syncResult.error || "AutoCount API sync failed — please retry",
    });
    invoice.status = "ERROR";
    invoice.syncError = syncResult.error || "AutoCount API sync failed — please retry";
  }

  return NextResponse.json({ invoice });
}
