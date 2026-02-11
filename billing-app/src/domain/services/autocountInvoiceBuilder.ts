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
      taxCode: null,
      taxAdjustment: 0,
      localTaxAdjustment: 0,
      tariffCode: null,
      localTotalCost: 0,
      classificationCode: "022",
    });
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

  const furtherDescTemplate =
    customer.furtherDescriptionTemplate ||
    accountBook.furtherDescriptionTemplate ||
    DEFAULT_FURTHER_DESCRIPTION_TEMPLATE;

  const resolvedInvoiceDescription = resolveTemplate(invoiceDescTemplate, templateContext);
  const resolvedFurtherDescription = resolveTemplate(furtherDescTemplate, templateContext);

  // Apply furtherDescription to each detail line
  for (const detail of details) {
    detail.furtherDescription = resolvedFurtherDescription;
  }

  // Calculate doc date (1st day of the month following the billing cycle)
  const [year, month] = billingMonth.split("-");
  const nextMonthDate = new Date(parseInt(year), parseInt(month), 1);
  const firstDayOfNextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-${String(nextMonthDate.getDate()).padStart(2, "0")}`;

  // Build invoice master
  const master: AutoCountInvoiceMaster = {
    docNo: null,
    docNoFormatName: null,
    docDate: firstDayOfNextMonth,
    taxDate: null,
    debtorCode: debtorCode,
    debtorName: customer.name,
    creditTerm,
    salesLocation,
    salesAgent: "Olivia Yap",
    email: null,
    address: null,
    ref: null,
    description: resolvedInvoiceDescription,
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
  };

  // Build auto-fill options
  const autoFillOption: AutoCountAutoFillOption = {
    accNo: false,
    taxCode: true,
    tariffCode: false,
    localTotalCost: true,
  };

  const payload: AutoCountInvoicePayload = {
    master,
    details,
    autoFillOption,
    saveApprove: null,
  };

  return { success: true, payload };
}
