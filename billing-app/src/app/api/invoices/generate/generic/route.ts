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
import { insertInvoice } from "@/infrastructure/db/invoiceRepository";
import { generateTempDocNo } from "@/domain/utils/tempDocNo";
import { InvoiceHistory, InvoiceLineItem } from "@/types";

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

    // Filter to active, non-skipped items
    const activeLineItems = lineItems.filter(
      (li) => !li.reconServerStatus || li.reconServerStatus !== "FAILED"
    );

    // Group INGLAB items by projectName (usage + platform fee for same project share same projectName).
    // Non-INGLAB items have no projectName → group by "DEFAULT".
    const groups = new Map<string, InvoiceLineItem[]>();
    for (const li of activeLineItems) {
      const key = li.projectName || "DEFAULT";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(li);
    }

    // Generate one invoice per group
    const invoices = [];
    for (const [, groupItems] of Array.from(groups.entries())) {
      const projectName = groupItems[0]?.projectName || "";
      // Primary serviceId = first non-platform-fee serviceId in the group (e.g., ZURICH-001 not ZURICH-001-1)
      const primaryServiceId = groupItems.find(
        (li) => li.serviceId && !li.serviceId.endsWith("-1")
      )?.serviceId || groupItems[0]?.serviceId || "";

      // Build AutoCount invoice payload with serviceId/projectName overrides
      const buildResult = await buildAutoCountInvoice({
        customer,
        billingMonth,
        lineItems: groupItems,
        serviceId: primaryServiceId,
        projectName,
      });

      const totalAmount = groupItems.reduce((sum, li) => sum + li.totalCharge, 0);

      if (!buildResult.success || !buildResult.payload) {
        // Build error invoice record
        const errorInvoice: InvoiceHistory = {
          id: `inv-${Date.now()}`,
          tempDocNo: generateTempDocNo(),
          customerId,
          customerName: customer.name,
          billingMonth,
          totalAmount,
          status: "ERROR",
          syncError: buildResult.error || "Failed to build AutoCount invoice",
          createdAt: new Date().toISOString(),
          billingMode: customer.billingMode,
          schedule: customer.schedule,
          generatedBy: "MANUAL",
          lineItems: groupItems,
          serviceId: primaryServiceId,
          projectName,
        };
        await insertInvoice(errorInvoice);
        continue;
      }

      if (MOCK_MODE) {
        // Log payload, save as DRAFT
        const fs = await import("fs/promises");
        const path = await import("path");
        const logDir = path.join(process.cwd(), "logs");
        await fs.mkdir(logDir, { recursive: true });
        await fs.appendFile(
          path.join(logDir, "generic-mock-invoices.log"),
          JSON.stringify({ invoiceId: `inv-${Date.now()}`, customerId, billingMonth, payload: buildResult.payload }, null, 2) + "\n"
        );

        const invoice: InvoiceHistory = {
          id: `inv-${Date.now()}`,
          tempDocNo: generateTempDocNo(),
          customerId,
          customerName: customer.name,
          billingMonth,
          totalAmount,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
          billingMode: customer.billingMode,
          schedule: customer.schedule,
          generatedBy: "MANUAL",
          lineItems: groupItems,
          serviceId: primaryServiceId,
          projectName,
        };
        await insertInvoice(invoice);
        invoices.push({ ...invoice, status: "DRAFT" });
      } else {
        // TODO: Real AutoCount sync when not in mock mode
        // For now, save as DRAFT with note
        const invoice: InvoiceHistory = {
          id: `inv-${Date.now()}`,
          tempDocNo: generateTempDocNo(),
          customerId,
          customerName: customer.name,
          billingMonth,
          totalAmount,
          status: "DRAFT",
          createdAt: new Date().toISOString(),
          billingMode: customer.billingMode,
          schedule: customer.schedule,
          generatedBy: "MANUAL",
          lineItems: groupItems,
          serviceId: primaryServiceId,
          projectName,
        };
        await insertInvoice(invoice);
        invoices.push(invoice);
      }
    }

    return NextResponse.json({ invoices, billingMonth, customerId });
  } catch (error) {
    console.error("Error generating invoice:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
