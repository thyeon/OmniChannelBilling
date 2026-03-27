/**
 * Generic Billing Service
 *
 * Multi-customer billing service that iterates over configurable data sources.
 * Supports COWAY_API, RECON_SERVER, and CUSTOM_REST_API data source types.
 */

import { Customer, InvoiceLineItem, ServiceType, ConnectionStatus } from "@/types";
import { DataSource } from "@/domain/models/dataSource";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import {
  findDataSourcesByCustomerId,
  findActiveDataSourcesByCustomerId,
} from "@/infrastructure/db/dataSourceRepository";
import { fetchCowayBillable, fetchWhatsAppBillable } from "@/infrastructure/external/cowayClient";
import { fetchEmailReconSummary } from "@/infrastructure/external/reconClient";
import { resolveTokens } from "./templateTokenResolver";
import { processMultiLine, processLegacySingleLine, processInglabNested } from "./lineItemProcessor";
import { resolveRate } from "./rateResolver";
import { getDateRange } from "@/infrastructure/external/cowayClient";

interface BillableDataResult {
  customer: Customer | null;
  lineItems: InvoiceLineItem[];
  reason?: "skipped";
}

/** Fetch with retry logic and optional fallback. */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  dataSource?: DataSource
): Promise<unknown> {
  const maxRetries = dataSource?.retryPolicy?.maxRetries ?? 0;
  const delayMs = (dataSource?.retryPolicy?.retryDelaySeconds ?? 1) * 1000;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout((dataSource?.retryPolicy?.timeoutSeconds ?? 60) * 1000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (dataSource?.fallbackValues?.useDefaultOnMissing) {
    console.log(`Using fallback due to API failure for ${dataSource.id}`);
    return { usageCount: dataSource.fallbackValues.usageCount ?? 0 };
  }
  throw lastError || new Error("All retry attempts failed");
}

/** Create an error line item. */
function makeErrorLineItem(dataSource: DataSource, customer: Customer, message: string): InvoiceLineItem {
  const rate = customer.rates?.[dataSource.serviceType] || 0;
  return {
    dataSourceId: dataSource.id,
    service: dataSource.serviceType,
    hasProvider: false,
    reconServerStatus: "FAILED",
    providerStatus: "NOT_CONFIGURED",
    reconServerName: message,
    providerName: "",
    reconTotal: 0,
    reconDetails: { sent: 0, failed: 0, withheld: 0 },
    providerTotal: 0,
    discrepancyPercentage: 0,
    isMismatch: false,
    thresholdUsed: customer.discrepancyThreshold || 0,
    billableCount: 0,
    wasOverridden: false,
    rate,
    totalCharge: 0,
  };
}

/**
 * Helper function to get nested value from object using JSON path.
 * Supports paths like "data.0.line_items.0.qty"
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array index notation (e.g., "0" or "[0]")
    const indexMatch = part.match(/^(\d+)$/);
    if (indexMatch && Array.isArray(current)) {
      current = current[parseInt(indexMatch[1], 10)];
      continue;
    }

    // Handle bracket notation (e.g., "items[0].qty")
    const bracketMatch = part.match(/^(.+?)\[(\d+)\]$/);
    if (bracketMatch) {
      const key = bracketMatch[1];
      const index = parseInt(bracketMatch[2], 10);
      if (typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
        if (Array.isArray(current)) {
          current = current[index];
        }
      } else {
        return undefined;
      }
      continue;
    }

    // Handle dot notation (e.g., "data.count")
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Convert billable count to InvoiceLineItem for a data source.
 */
function createLineItemFromData(
  dataSource: DataSource,
  usageCount: number,
  customer: Customer,
  sentCount?: number,
  failedCount?: number,
  lineIdentifier?: string
): InvoiceLineItem {
  const rate = customer.rates?.[dataSource.serviceType] || 0;

  return {
    dataSourceId: dataSource.id,
    lineIdentifier,
    service: dataSource.serviceType,
    hasProvider: true,
    reconServerStatus: "SUCCESS" as ConnectionStatus,
    providerStatus: "SUCCESS" as ConnectionStatus,
    reconServerName: dataSource.name,
    providerName: getProviderName(dataSource.serviceType),
    reconTotal: usageCount,
    reconDetails: {
      sent: sentCount ?? usageCount,
      failed: failedCount ?? 0,
      withheld: 0,
    },
    providerTotal: usageCount,
    discrepancyPercentage: 0,
    isMismatch: false,
    thresholdUsed: customer.discrepancyThreshold || 0,
    billableCount: usageCount,
    wasOverridden: false,
    rate,
    totalCharge: usageCount * rate,
  };
}

/**
 * Get provider name for a service type (default values)
 */
function getProviderName(serviceType: ServiceType): string {
  switch (serviceType) {
    case "SMS":
      return "GTS";
    case "WHATSAPP":
      return "Ali";
    case "EMAIL":
      return "Email Provider";
    default:
      return "Unknown";
  }
}

/**
 * Create an empty/error line item for a data source
 */
function createErrorLineItem(
  dataSource: DataSource,
  customer: Customer,
  errorMessage: string
): InvoiceLineItem {
  const rate = customer.rates?.[dataSource.serviceType] || 0;

  return {
    dataSourceId: dataSource.id,
    service: dataSource.serviceType,
    hasProvider: false,
    reconServerStatus: "FAILED" as ConnectionStatus,
    providerStatus: "NOT_CONFIGURED" as ConnectionStatus,
    reconServerName: errorMessage,
    providerName: "",
    reconTotal: 0,
    reconDetails: {
      sent: 0,
      failed: 0,
      withheld: 0,
    },
    providerTotal: 0,
    discrepancyPercentage: 0,
    isMismatch: false,
    thresholdUsed: customer.discrepancyThreshold || 0,
    billableCount: 0,
    wasOverridden: true,
    overrideReason: errorMessage,
    rate,
    totalCharge: 0,
  };
}

/**
 * Fetch billable line items for a specific data source.
 * Returns one InvoiceLineItem per lineIdentifier (for multi-line) or one item per dataSource (for single-line).
 */
async function fetchBillableForDataSource(
  dataSource: DataSource,
  billingMonth: string,
  customer: Customer
): Promise<InvoiceLineItem[]> {
  function makeLineItem(
    count: number,
    sent?: number,
    failed?: number,
    lineIdentifier?: string
  ): InvoiceLineItem {
    const rate = customer.rates?.[dataSource.serviceType] || 0;
    return {
      dataSourceId: dataSource.id,
      lineIdentifier,
      service: dataSource.serviceType,
      hasProvider: true,
      reconServerStatus: "SUCCESS",
      providerStatus: "SUCCESS",
      reconServerName: dataSource.name,
      providerName: getProviderName(dataSource.serviceType),
      reconTotal: count,
      reconDetails: { sent: sent ?? count, failed: failed ?? 0, withheld: 0 },
      providerTotal: count,
      discrepancyPercentage: 0,
      isMismatch: false,
      thresholdUsed: customer.discrepancyThreshold || 0,
      billableCount: count,
      wasOverridden: false,
      rate,
      totalCharge: count * rate,
    };
  }

  try {
    switch (dataSource.type) {
      case "COWAY_API": {
        // COWAY_API uses user/secret/serviceProvider from dataSource.authCredentials
        const user = (dataSource.authCredentials?.user || "").trim();
        const secret = (dataSource.authCredentials?.secret || "").trim();
        const serviceProvider = (dataSource.authCredentials?.serviceProvider || "gts").trim();
        if (!user || !secret) {
          return [makeErrorLineItem(dataSource, customer, "Missing COWAY_API credentials (user/secret)")];
        }

        const { dtFrom, dtTo } = getDateRange(billingMonth);
        const body = { user, secret, serviceProvider, dtFrom, dtTo };
        const json = await fetchWithRetry(dataSource.apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // Detect API-level errors (e.g., { success: false, error_code: "301", error_message: "..." })
        if (typeof json === "object" && json !== null && "success" in json && (json as Record<string, unknown>).success === false) {
          const errMsg = (json as Record<string, unknown>).error_message as string || "Unknown API error";
          return [makeErrorLineItem(dataSource, customer, `COWAY_API error: ${errMsg}`)];
        }

        const singleLineResult = processLegacySingleLine(json, dataSource.responseMapping);
        let { usageCount, sentCount, failedCount } = singleLineResult;
        if (
          dataSource.fallbackValues?.useDefaultOnMissing &&
          usageCount === 0 &&
          dataSource.fallbackValues.usageCount !== undefined
        ) {
          usageCount = dataSource.fallbackValues.usageCount;
        }
        if (usageCount === 0) return [];
        // Pass serviceProvider as lineIdentifier so customer product mappings can differentiate per-provider
        return [makeLineItem(usageCount, sentCount, failedCount, serviceProvider)];
      }

      case "RECON_SERVER": {
        if (dataSource.serviceType === "WHATSAPP") {
          const apiKey = dataSource.authCredentials?.key || "";
          const userId = dataSource.authCredentials?.username || "";
          const count = await fetchWhatsAppBillable(billingMonth, {
            apiEndpoint: dataSource.apiEndpoint,
            userId,
            apiKey,
          });
          if (count === 0) return [];
          return [makeLineItem(count)];
        } else if (dataSource.serviceType === "EMAIL") {
          const result = await fetchEmailReconSummary(
            {
              id: dataSource.id || "",
              name: dataSource.name,
              type: "EMAIL",
              userId: dataSource.authCredentials?.username || "",
              apiKey: dataSource.authCredentials?.key || "",
              apiEndpoint: dataSource.apiEndpoint,
            },
            billingMonth
          );
          const count = result.count || 0;
          if (count === 0) return [];
          return [makeLineItem(count)];
        }
        return [];
      }

      case "CUSTOM_REST_API": {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (dataSource.authType === "API_KEY" && dataSource.authCredentials?.key) {
          // Use custom headerName if set, otherwise default to X-API-Key
          const headerKey = dataSource.authCredentials.headerName || "X-API-Key";
          headers[headerKey] = dataSource.authCredentials.key;
        } else if (dataSource.authType === "BEARER_TOKEN" && dataSource.authCredentials?.token) {
          headers["Authorization"] = `Bearer ${dataSource.authCredentials.token}`;
        } else if (
          dataSource.authType === "BASIC_AUTH" &&
          dataSource.authCredentials?.username &&
          dataSource.authCredentials?.password
        ) {
          headers["Authorization"] = `Basic ${Buffer.from(
            `${dataSource.authCredentials.username}:${dataSource.authCredentials.password}`
          ).toString("base64")}`;
        }

        const method = dataSource.requestTemplate?.method || "GET";
        let url = dataSource.apiEndpoint;
        if (method === "GET") {
          url = dataSource.apiEndpoint.includes("?")
            ? `${dataSource.apiEndpoint}&period=${billingMonth}`
            : `${dataSource.apiEndpoint}?period=${billingMonth}`;
        } else if (method === "POST") {
          url = resolveTokens(dataSource.apiEndpoint, billingMonth);
        }

        let fetchOptions: RequestInit = { method, headers };
        if (method === "POST" && dataSource.requestTemplate?.bodyTemplate) {
          fetchOptions = {
            ...fetchOptions,
            body: resolveTokens(dataSource.requestTemplate.bodyTemplate, billingMonth),
          };
        }

        const json = await fetchWithRetry(url, fetchOptions);

        // Check if this is an INGLAB nested response DataSource
        if (dataSource.nestedResponseConfig && dataSource.sourceClientId) {
          // Append ?client_id= to the URL
          const clientIdParam = `client_id=${encodeURIComponent(dataSource.sourceClientId)}`;
          const urlWithClient = url.includes("?")
            ? `${url}&${clientIdParam}`
            : `${url}?${clientIdParam}`;

          const nestedResponse = await fetchWithRetry(urlWithClient, fetchOptions);
          const nestedResults = processInglabNested(nestedResponse, dataSource.nestedResponseConfig);

          const items: InvoiceLineItem[] = [];
          for (const nl of nestedResults) {
            if (nl.qty === 0) continue;

            // Gap 2 fix: unit_price = 0 is VALID (charge $0). undefined falls back to configured rate.
            const resolvedUnitPrice = (nl.unitPrice !== undefined && nl.unitPrice !== null)
              ? nl.unitPrice
              : (customer.rates?.[dataSource.serviceType] ?? 0);

            // Gap 1 fix: totalCharge uses resolvedUnitPrice (not raw nl.unitPrice which may be undefined)
            const totalCharge = nl.qty * resolvedUnitPrice;

            items.push({
              dataSourceId: dataSource.id,
              lineIdentifier: nl.description,
              service: dataSource.serviceType,
              hasProvider: true,
              reconServerStatus: "SUCCESS",
              providerStatus: "SUCCESS",
              reconServerName: dataSource.name,
              providerName: getProviderName(dataSource.serviceType),
              reconTotal: nl.qty,
              reconDetails: { sent: nl.qty, failed: 0, withheld: 0 },
              providerTotal: nl.qty,
              discrepancyPercentage: 0,
              isMismatch: false,
              thresholdUsed: customer.discrepancyThreshold || 0,
              billableCount: nl.qty,
              wasOverridden: false,
              rate: resolvedUnitPrice,       // Gap 3 fix: ensures {SMSRate} in templates = INGLAB unit_price
              totalCharge,
              unitPrice: nl.unitPrice,      // original INGLAB unit_price (may be 0 or undefined)
              description: nl.description,
              descriptionDetail: nl.descriptionDetail,
              lineItemService: nl.service,
            });
          }
          return items;
        }

        // Multi-line: one InvoiceLineItem per lineIdentifier
        if (dataSource.lineItemMappings && dataSource.lineItemMappings.length > 0) {
          const multiLineResults = processMultiLine(json, dataSource.lineItemMappings);
          const items: InvoiceLineItem[] = [];
          for (const lineResult of multiLineResults) {
            let count = lineResult.count;
            if (
              dataSource.fallbackValues?.useDefaultOnMissing &&
              count === 0 &&
              dataSource.fallbackValues.usageCount !== undefined
            ) {
              count = dataSource.fallbackValues.usageCount;
            }
            if (count > 0) items.push(makeLineItem(count, count, undefined, lineResult.lineIdentifier));
          }
          return items;
        }

        // Single-line
        const singleLineResult = processLegacySingleLine(json, dataSource.responseMapping);
        let { usageCount, sentCount, failedCount } = singleLineResult;
        if (
          dataSource.fallbackValues?.useDefaultOnMissing &&
          usageCount === 0 &&
          dataSource.fallbackValues.usageCount !== undefined
        ) {
          usageCount = dataSource.fallbackValues.usageCount;
        }
        if (usageCount === 0) return [];
        return [makeLineItem(usageCount, sentCount, failedCount)];
      }

      default:
        console.warn(`Unknown data source type: ${dataSource.type}`);
        return [];
    }
  } catch (error) {
    console.error(`Failed to fetch billable data for data source ${dataSource.id}:`, error);
    return [makeErrorLineItem(dataSource, customer, `Failed: ${error instanceof Error ? error.message : String(error)}`)];
  }
}

/**
 * Determine if a customer should be billed for the given month based on their billing cycle.
 *
 * @param customer - The customer to check
 * @param billingMonth - Format: "2026-03"
 * @returns true if billing should occur this month, false otherwise
 */
export function shouldBillThisMonth(customer: Customer, billingMonth: string): boolean {
  const month = parseInt(billingMonth.split('-')[1], 10);
  const billingCycle = customer.billingCycle || 'MONTHLY';

  switch (billingCycle) {
    case 'MONTHLY':
      // Always bill monthly customers
      return true;

    case 'QUARTERLY':
      // Bill in months 1, 4, 7, 10 (January, April, July, October)
      return (month - 1) % 3 === 0;

    case 'YEARLY':
      // Bill only in the configured start month (defaults to January if not set)
      const startMonth = customer.billingStartMonth ?? 1;
      return month === startMonth;

    default:
      return true;
  }
}

/**
 * Generate billable data for a customer using their configured data sources.
 * This is the main entry point for the generic billing service.
 *
 * @param customerId - The customer ID
 * @param billingMonth - Format: "2026-03"
 * @returns Object containing customer config and invoice line items
 */
export async function generateBillableData(
  customerId: string,
  billingMonth: string
): Promise<BillableDataResult> {
  // Get customer config from MongoDB
  const customer = await findCustomerById(customerId);

  if (!customer) {
    return {
      customer: null,
      lineItems: [],
    };
  }

  // Check customer status - skip non-ACTIVE customers (treat missing status as ACTIVE for backward compat)
  const effectiveStatus = customer.status ?? 'ACTIVE';
  if (effectiveStatus !== 'ACTIVE') {
    console.log(`Customer ${customerId} has status '${effectiveStatus}', skipping billing`);
    return {
      customer,
      lineItems: [],
      reason: 'skipped',
    };
  }

  // Check billing cycle - skip if not the right month
  if (!shouldBillThisMonth(customer, billingMonth)) {
    console.log(
      `Customer ${customerId} has billing cycle '${customer.billingCycle || 'MONTHLY'}' and is not scheduled for ${billingMonth}`
    );
    return {
      customer,
      lineItems: [],
      reason: 'skipped',
    };
  }

  // Get active data sources for the customer
  const dataSources = await findActiveDataSourcesByCustomerId(customerId);

  if (dataSources.length === 0) {
    // Fall back to legacy billing if no data sources configured
    console.log(
      `No data sources configured for customer ${customerId}, using legacy billing`
    );
    return {
      customer,
      lineItems: [],
    };
  }

  const lineItems: InvoiceLineItem[] = [];

  // Iterate through each active data source — fetchBillableForDataSource returns
  // InvoiceLineItem[] directly (one per lineIdentifier for multi-line, one per
  // dataSource for single-line), so just spread them into lineItems.
  for (const dataSource of dataSources) {
    const items = await fetchBillableForDataSource(dataSource, billingMonth, customer);
    lineItems.push(...items);
  }

  return {
    customer,
    lineItems,
  };
}

/**
 * Get all data sources for a customer (not just active ones).
 * Useful for administration purposes.
 */
export async function getDataSourcesForCustomer(
  customerId: string
): Promise<DataSource[]> {
  return findDataSourcesByCustomerId(customerId);
}

/**
 * Add a new data source for a customer.
 */
export async function addDataSourceForCustomer(
  customerId: string,
  dataSource: Omit<DataSource, "id" | "customerId" | "createdAt" | "updatedAt">
): Promise<DataSource> {
  const { createDataSource } = await import("@/infrastructure/db/dataSourceRepository");
  return createDataSource({
    ...dataSource,
    customerId,
  });
}
