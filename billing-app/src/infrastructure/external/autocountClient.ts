/**
 * AutoCount Cloud Accounting API Client
 *
 * Handles communication with AutoCount Cloud Accounting API for invoice creation.
 * Implements retry logic for rate limiting and proper error handling.
 */

const AUTOCOUNT_BASE_URL = "https://accounting-api.autocountcloud.com";

export interface AutoCountInvoiceMaster {
  docNo: string | null;
  docNoFormatName: string | null;
  docDate: string;
  taxDate: string | null;
  debtorCode: string;
  debtorName: string;
  creditTerm: string;
  salesLocation: string;
  salesAgent: string | null;
  email: string | null;
  address: string | null;
  emailCC?: string | null;
  emailBCC?: string | null;
  attention?: string | null;
  phone1?: string | null;
  fax1?: string | null;
  deliverAddress?: string | null;
  deliverContact?: string | null;
  deliverPhone1?: string | null;
  deliverFax1?: string | null;
  ref: string | null;
  description: string | null;
  note: string | null;
  remark1: string | null;
  remark2: string | null;
  remark3: string | null;
  remark4: string | null;
  currencyRate: number;
  inclusiveTax: boolean;
  isRoundAdj: boolean;
  paymentMethod: string | null;
  toBankRate: number;
  paymentAmt: number;
  paymentRef: string | null;
  taxEntity?: string;
}

export interface AutoCountInvoiceDetail {
  productCode: string | null;
  productVariant?: string | null;
  accNo: string;
  description: string;
  furtherDescription?: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discount: number | null;
  taxCode: string | null;
  taxAdjustment: number;
  localTaxAdjustment: number;
  tariffCode: string | null;
  taxExportCountry?: string | null;
  taxPermitNo?: string | null;
  localTotalCost: number;
  yourPONo?: string | null;
  yourPODate?: string | null;
  deptNo?: string | null;
  unitType?: string;
  classificationCode?: string;
}

export interface AutoCountAutoFillOption {
  accNo: boolean;
  taxCode: boolean;
  tariffCode: boolean;
  localTotalCost: boolean;
}

export interface AutoCountInvoicePayload {
  master: AutoCountInvoiceMaster;
  details: AutoCountInvoiceDetail[];
  autoFillOption: AutoCountAutoFillOption;
  saveApprove: boolean | null;
}

export interface AutoCountInvoiceResponse {
  success: boolean;
  docNo?: string;
  error?: string;
}

export interface AutoCountCredentials {
  accountBookId: string;
  keyId: string;
  apiKey: string;
}

/**
 * Create an invoice in AutoCount.
 *
 * @param credentials - AutoCount credentials (accountBookId, keyId, apiKey)
 * @param payload - Invoice payload
 * @returns Invoice response with docNo on success, or error message on failure
 */
export async function createInvoice(
  credentials: AutoCountCredentials,
  payload: AutoCountInvoicePayload
): Promise<AutoCountInvoiceResponse> {
  const { accountBookId, keyId, apiKey } = credentials;
  const url = `${AUTOCOUNT_BASE_URL}/${accountBookId}/invoice`;

  let lastError: Error | null = null;

  // Retry logic for rate limiting (429) and transient errors (5xx)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Key-ID": keyId,
          "API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 201) {
        // Success - extract docNo from location header
        const location = response.headers.get("location");
        const docNo = location?.match(/docNo=([^&]+)/)?.[1];
        return { success: true, docNo };
      }

      if (response.status === 429) {
        // Rate limited - wait and retry with exponential backoff
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      if (response.status >= 500) {
        // Server error - retry
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // Client error (4xx) - don't retry
      const errorBody = await response.json();
      const errorMessage =
        errorBody?.message || `AutoCount API error: ${response.status}`;
      return { success: false, error: errorMessage };
    } catch (error) {
      lastError = error as Error;
      if (attempt < 3) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError?.message || "Failed to create invoice after 3 attempts",
  };
}

/**
 * Test AutoCount credentials by fetching debtor list.
 *
 * @param credentials - AutoCount credentials
 * @returns Success status and error message if failed
 */
export async function testConnection(
  credentials: AutoCountCredentials
): Promise<{ success: boolean; error?: string }> {
  const { accountBookId, keyId, apiKey } = credentials;
  const url = `${AUTOCOUNT_BASE_URL}/${accountBookId}/debtor/listing?page=1&activeOnly=true`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Key-ID": keyId,
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { success: true };
    }

    const errorBody = await response.json();
    return {
      success: false,
      error: errorBody?.message || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
