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
  findAccountBookByAccountBookId,
} from "@/infrastructure/db/autoCountAccountBookRepository";
import {
  findMappingByAccountBookAndService,
} from "@/infrastructure/db/serviceProductMappingRepository";
import {
  findCustomerProductMappingByKey,
} from "@/infrastructure/db/customerProductMappingRepository";
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

  // Fetch account book configuration — try internal DB id first, then fall back to AutoCount accountBookId
  let accountBook = await findAccountBookById(customer.autocountAccountBookId);
  if (!accountBook) {
    // Fallback: customer.autocountAccountBookId may contain the AutoCount accountBookId directly
    accountBook = await findAccountBookByAccountBookId(customer.autocountAccountBookId);
  }
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

  // Build template context for placeholder resolution (needed inside loop for per-line furtherDesc)
  const totalAmount = lineItems.reduce((sum, li) => sum + li.totalCharge, 0);
  const templateContext: TemplateContext = {
    billingMonth,
    customerName: customer.name,
    totalAmount,
    lineItems,
  };

  // Build invoice details
  const details: AutoCountInvoiceDetail[] = [];
  const errors: string[] = [];

  for (const lineItem of lineItems) {
    // Look up per-DataSource per-lineIdentifier mapping first, fall back to
    // account-book-level mapping if no per-datasource mapping exists
    const customerMapping = lineItem.lineIdentifier
      ? await findCustomerProductMappingByKey(customer.id, lineItem.service, lineItem.lineIdentifier)
      : null;
    const accountBookMapping = await findMappingByAccountBookAndService(
      accountBook.id,
      lineItem.service
    );
    const mapping = customerMapping ?? accountBookMapping;

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

    // Resolve billing mode:
    // 1. customer service override (by serviceType only, no lineIdentifier)
    // 2. customer-specific product mapping (has billingMode field)
    // 3. account-book-level mapping (has defaultBillingMode field)
    // 4. fallback to LUMP_SUM
    // ⚠️ Gap 3 fix: billingMode=ITEMIZED when lineItem.unitPrice is present (INGLAB provides actual price)
    const billingMode =
      (lineItem.unitPrice !== undefined && lineItem.unitPrice !== null)
        ? "ITEMIZED"
        : (customerOverride?.billingMode ||
          (customerMapping as { billingMode?: string } | null)?.billingMode ||
          (accountBookMapping as { defaultBillingMode?: string } | null)?.defaultBillingMode ||
          "LUMP_SUM");

    // ⚠️ Gap 1 fix: unitPrice = 0 is VALID (charge $0). undefined/null falls back to configured rate.
    const resolvedUnitPrice = (lineItem.unitPrice !== undefined && lineItem.unitPrice !== null)
      ? lineItem.unitPrice
      : (billingMode === "LUMP_SUM"
          ? lineItem.totalCharge
          : (customerMapping?.defaultUnitPrice ?? accountBookMapping?.defaultUnitPrice ?? lineItem.rate)
      );

    // description: short item name only (descriptionDetail / exchange rate info belongs in furtherDescription)
    const resolvedDescription = lineItem.description
      ? `${lineItem.description} - ${billingMonth}`
      : lineDescription;

    // LUMP_SUM: qty=1, unitPrice=totalCharge (avoids AutoCount 2dp rounding)
    // ITEMIZED: qty=billableCount, unitPrice=defaultUnitPrice from mapping (customer mapping
    //            → account book mapping → lineItem.rate fallback)
    const qty = billingMode === "LUMP_SUM" ? 1 : lineItem.billableCount;
    const unitPrice = resolvedUnitPrice;

    // Resolve furtherDescription: INGLAB descriptionDetail (exchange rate info) takes priority,
    // then customer mapping template → account book mapping template → account book default → global default
    let resolvedFurtherDesc: string | undefined;
    if (lineItem.descriptionDetail) {
      // INGLAB provides structured billing info (exchange rate, per-message cost, billing period)
      resolvedFurtherDesc = lineItem.descriptionDetail;
    } else {
      const furtherDescTemplate =
        (customerMapping as { furtherDescriptionTemplate?: string } | null)?.furtherDescriptionTemplate ||
        (mapping as { furtherDescriptionTemplate?: string } | null)?.furtherDescriptionTemplate ||
        accountBook.furtherDescriptionTemplate ||
        DEFAULT_FURTHER_DESCRIPTION_TEMPLATE;
      resolvedFurtherDesc = resolveTemplate(furtherDescTemplate, templateContext, lineItem);
    }

    details.push({
      productCode: resolvedProductCode,
      accNo: accountBook.defaultAccNo || "500-0000",
      description: resolvedDescription,
      furtherDescription: resolvedFurtherDesc,
      qty,
      unit: "unit",
      unitPrice,
      discount: null,
      taxCode: accountBook.defaultTaxCode || null,
      taxAdjustment: 0,
      localTaxAdjustment: 0,
      tariffCode: null,
      localTotalCost: 0,
      classificationCode: accountBook.defaultClassificationCode || "022",
    });
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join("; "),
    };
  }

  // Resolve master invoice description: customer override → account book default → hardcoded fallback
  const invoiceDescTemplate =
    customer.invoiceDescriptionTemplate ||
    accountBook.invoiceDescriptionTemplate ||
    DEFAULT_INVOICE_DESCRIPTION_TEMPLATE;

  const resolvedInvoiceDescription = resolveTemplate(invoiceDescTemplate, templateContext);

  // Calculate doc date — AutoCount API expects YYYY-MM-DD format per documentation
  const today = new Date();
  const todayYYYYMMDD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Build invoice master
  const master: AutoCountInvoiceMaster = {
    docNo: null,
    docNoFormatName: null,
    docDate: todayYYYYMMDD,
    taxDate: todayYYYYMMDD,
    debtorCode: debtorCode,
    debtorName: customer.name,
    creditTerm,
    salesLocation,
    salesAgent: accountBook.defaultSalesAgent || "Olivia Yap",
    email: customer.defaultFields?.email || null,
    address: customer.defaultFields?.address || null,
    emailCC: null,
    emailBCC: null,
    attention: null,
    phone1: null,
    fax1: null,
    deliverAddress: null,
    deliverContact: null,
    deliverPhone1: null,
    deliverFax1: null,
    ref: null,
    description: resolvedInvoiceDescription,
    note: null,
    remark1: null,
    remark2: null,
    remark3: null,
    remark4: null,
    currencyRate: 1,
    inclusiveTax: accountBook.inclusiveTax ?? false,
    isRoundAdj: false,
    paymentMethod: null,
    toBankRate: 1,
    paymentAmt: 0,
    paymentRef: null,
    taxEntity: customer.defaultFields?.taxEntity || accountBook.taxEntity || undefined,
  };

  // Build auto-fill options — per-customer from defaultFields, fall back to previous hardcoded defaults
  const autoFillOption: AutoCountAutoFillOption = {
    accNo: customer.defaultFields?.autoFillAccNo ?? false,
    taxCode: customer.defaultFields?.autoFillTaxCode ?? true,
    tariffCode: customer.defaultFields?.autoFillTariffCode ?? false,
    localTotalCost: customer.defaultFields?.autoFillLocalTotalCost ?? true,
  };

  const payload: AutoCountInvoicePayload = {
    master,
    details,
    autoFillOption,
    saveApprove: customer.defaultFields?.saveApprove ?? false,
  };

  return { success: true, payload };
}
