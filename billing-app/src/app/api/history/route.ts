import { NextRequest, NextResponse } from "next/server";
import { InvoiceStatus } from "@/types";
import {
  findAllInvoices,
  findInvoicesByCustomer,
} from "@/infrastructure/db/invoiceRepository";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    let invoices = customerId
      ? await findInvoicesByCustomer(customerId)
      : await findAllInvoices();

    if (status && status !== "ALL") {
      invoices = invoices.filter(
        (invoice) => invoice.status === (status as InvoiceStatus)
      );
    }

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Failed to fetch invoice history:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice history" },
      { status: 500 }
    );
  }
}
