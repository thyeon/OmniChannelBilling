/**
 * AutoCount Invoice Builder
 *
 * Builds AutoCount invoice payloads from customer data and usage data.
 * Handles resolution of credit terms, sales locations, and product codes
 * according to the Option C hybrid approach (customer override → account book default → error).
 */

import { Customer, InvoiceLineItem } from "@/types";
import {
  findAccountBookById,
} from "@/infrastructure/db/autoCountAccountBookRepository";
import {
  findMappingByAccountBookAndService,
} from "@/infrastructure/db/serviceProductMappingRepository";
import {
  findBillingClientByDebtorCode,
} from "@/infrastructure/db/billingClientRepository";
import {
  AutoCountInvoicePayload,
  AutoCountInvoiceMaster,
  AutoCountInvoiceDetail,
  AutoCountAutoFillOption,
} from "@/infrastructure/external/autocountClient";
import {
  resolveTemplate,
  TemplateContext,
  DEFAULT_INVOICE_DESCRIPTION_TEMPLATE,
  DEFAULT_FURTHER_DESCRIPTION_TEMPLATE,
} from "@/domain/services/templateResolver";

interface BuildInvoiceOptions {
  customer: Customer;
  billingMonth: string;
  lineItems: InvoiceLineItem[];
}

interface BuildInvoiceResult {
  success: boolean;
  payload?: AutoCountInvoicePayload;
  error?: string;
}

/**
 * Build an AutoCount invoice payload from customer and usage data.
 */
export async function buildAutoCountInvoice(
  options: BuildInvoiceOptions
): Promise<BuildInvoiceResult> {
  const { customer, billingMonth, lineItems } = options;

  // Check if customer has AutoCount configuration
  const debtorCode = customer.autocountDebtorCode || customer.autocountCustomerId;
  if (!customer.autocountAccountBookId || !debtorCode) {
    return {
      success: false,
      error: "Customer is not configured for AutoCount billing (missing account book or debtor code)",
    };
  }

  // Fetch account book configuration
  const accountBook = await findAccountBookById(customer.autocountAccountBookId);
  if (!accountBook) {
    return {
      success: false,
      error: "AutoCount account book not found",
    };
  }

  // Fetch billing client for address
  const billingClient = await findBillingClientByDebtorCode(debtorCode);

  // Resolve credit term: customer override → account book default → error
  const creditTerm =
    customer.creditTermOverride ?? accountBook.defaultCreditTerm;
  if (!creditTerm) {
    return {
      success: false,
      error: "Credit term not configured (no default in account book and no customer override)",
    };
  }

  // Resolve sales location: customer override → account book default → error
  const salesLocation =
    customer.salesLocationOverride ?? accountBook.defaultSalesLocation;
  if (!salesLocation) {
    return {
      success: false,
      error: "Sales location not configured (no default in account book and no customer override)",
    };
  }

  // Build invoice details
  const details: AutoCountInvoiceDetail[] = [];
  const detailMappings: Awaited<ReturnType<typeof findMappingByAccountBookAndService>>[] = [];
  const errors: string[] = [];

  for (const lineItem of lineItems) {
    // Always fetch the product mapping for description and defaults
    const mapping = await findMappingByAccountBookAndService(
      accountBook.id,
      lineItem.service
    );

    // Resolve product code: customer override → account book mapping → error
    const customerOverride = customer.serviceProductOverrides?.find(
      (o) => o.serviceType === lineItem.service
    );
    const resolvedProductCode = customerOverride?.productCode || mapping?.productCode;

    if (!resolvedProductCode) {
      errors.push(
        `No product code mapping for ${lineItem.service} service (no customer override and no account book mapping)`
      );
      continue;
    }

    // Use description from product mapping, fall back to generic format
    const lineDescription = mapping?.description
      ? `${mapping.description} - ${billingMonth}`
      : `${lineItem.service} Service - ${billingMonth}`;

    // Resolve billing mode: customer override → mapping default → LUMP_SUM fallback
    const billingMode =
      customerOverride?.billingMode ||
      mapping?.defaultBillingMode ||
      "LUMP_SUM";

    // LUMP_SUM: qty=1, unitPrice=totalCharge (avoids AutoCount 2dp rounding)
    // ITEMIZED: qty=billableCount, unitPrice=rate (use when rate has ≤2dp)
    const qty = billingMode === "LUMP_SUM" ? 1 : lineItem.billableCount;
    const unitPrice = billingMode === "LUMP_SUM" ? lineItem.totalCharge : lineItem.rate;

    details.push({
      productCode: resolvedProductCode,
      accNo: "500-0000", // TODO: Make configurable per account book
      description: lineDescription,
      qty,
      unit: "unit",
      unitPrice,
      discount: null,
      taxCode: mapping?.taxCode || accountBook.defaultTaxCode || null,
      taxAdjustment: 0,
      localTaxAdjustment: 0,
      tariffCode: null,
      localTotalCost: 0,
      classificationCode: "022",
    });

    // Store mapping reference for later template resolution
    detailMappings.push(mapping);
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join("; "),
    };
  }

  // Build template context for placeholder resolution
  const totalAmount = lineItems.reduce((sum, li) => sum + li.totalCharge, 0);
  const templateContext: TemplateContext = {
    billingMonth,
    customerName: customer.name,
    totalAmount,
    lineItems,
  };

  // Resolve description templates: customer override → account book default → hardcoded fallback
  const invoiceDescTemplate =
    customer.invoiceDescriptionTemplate ||
    accountBook.invoiceDescriptionTemplate ||
    DEFAULT_INVOICE_DESCRIPTION_TEMPLATE;

  const resolvedInvoiceDescription = resolveTemplate(invoiceDescTemplate, templateContext);

  // Truncate description to max 80 characters (AutoCount limit)
  const truncatedDescription = resolvedInvoiceDescription.slice(0, 80);

  // Apply furtherDescription to each detail line, resolved per service type
  // Resolution order: mapping template → customer override → account book default → default
  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    const mapping = detailMappings[i];

    const furtherDescTemplate =
      mapping?.furtherDescriptionTemplate ||
      customer.furtherDescriptionTemplate ||
      accountBook.furtherDescriptionTemplate ||
      DEFAULT_FURTHER_DESCRIPTION_TEMPLATE;

    detail.furtherDescription = resolveTemplate(furtherDescTemplate, templateContext);
  }

  // Calculate doc date (today)
  // Format as ISO 8601 date (YYYY-MM-DD) for AutoCount .NET API
  const today = new Date();
  const todayISO = today.toISOString().split("T")[0];

  // Build invoice master
  const master: AutoCountInvoiceMaster = {
    docNo: null,
    docNoFormatName: null,
    docDate: todayISO,
    taxDate: todayISO,
    debtorCode: debtorCode,
    debtorName: customer.name,
    creditTerm,
    salesLocation,
    salesAgent: "Olivia Yap",
    email: null,
    address: billingClient?.address || null,
    ref: null,
    description: truncatedDescription,
    note: null,
    remark1: null,
    remark2: null,
    remark3: null,
    remark4: null,
    currencyRate: 1,
    inclusiveTax: false,
    isRoundAdj: false,
    paymentMethod: null,
    toBankRate: 1,
    paymentAmt: 0,
    paymentRef: null,
    taxEntity: accountBook.taxEntity || undefined,
    submitEInvoice: false,
  };

  // Build auto-fill options
  const autoFillOption: AutoCountAutoFillOption = {
    accNo: false,
    taxCode: false, // Use provided taxCode instead of auto-filling from product
    tariffCode: false,
    localTotalCost: true,
  };

  const payload: AutoCountInvoicePayload = {
    master,
    details,
    autoFillOption,
    saveApprove: false,
  };

  return { success: true, payload };
}
