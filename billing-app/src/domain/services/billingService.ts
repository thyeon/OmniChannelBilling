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
import { processMultiLine, processLegacySingleLine } from "./lineItemProcessor";
import { resolveRate } from "./rateResolver";

interface BillableDataResult {
  customer: Customer | null;
  lineItems: InvoiceLineItem[];
  reason?: "skipped";
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
  failedCount?: number
): InvoiceLineItem {
  const rate = customer.rates?.[dataSource.serviceType] || 0;

  return {
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
 * Fetch billable data for a specific data source.
 * Switches on dataSource.type to determine which fetcher to use.
 */
async function fetchBillableForDataSource(
  dataSource: DataSource,
  billingMonth: string
): Promise<{ usageCount: number; sentCount?: number; failedCount?: number } | null> {
  try {
    switch (dataSource.type) {
      case "COWAY_API": {
        // Use Coway API for SMS data
        const data = await fetchCowayBillable(billingMonth);
        if (data.length > 0) {
          const usageCount = getNestedValue(
            data,
            dataSource.responseMapping.usageCountPath
          ) as number;
          return { usageCount: usageCount || 0 };
        }
        return { usageCount: 0 };
      }

      case "RECON_SERVER": {
        // Use WhatsApp or Email recon server based on serviceType
        if (dataSource.serviceType === "WHATSAPP") {
          // Need to extract auth credentials from dataSource
          const apiKey = dataSource.authCredentials?.key || "";
          const userId = dataSource.authCredentials?.username || "";
          const usageCount = await fetchWhatsAppBillable(billingMonth, {
            apiEndpoint: dataSource.apiEndpoint,
            userId,
            apiKey,
          });
          return { usageCount };
        } else if (dataSource.serviceType === "EMAIL") {
          // Use recon server config for email
          const usageCount = await fetchEmailReconSummary(
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
          return { usageCount: usageCount.count || 0 };
        }
        return null;
      }

      case "CUSTOM_REST_API": {
        // Generic HTTP call with auth
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        // Add auth headers based on authType
        if (dataSource.authType === "API_KEY" && dataSource.authCredentials?.key) {
          headers["X-API-Key"] = dataSource.authCredentials.key;
        } else if (
          dataSource.authType === "BEARER_TOKEN" &&
          dataSource.authCredentials?.token
        ) {
          headers["Authorization"] = `Bearer ${dataSource.authCredentials.token}`;
        } else if (
          dataSource.authType === "BASIC_AUTH" &&
          dataSource.authCredentials?.username &&
          dataSource.authCredentials?.password
        ) {
          const credentials = Buffer.from(
            `${dataSource.authCredentials.username}:${dataSource.authCredentials.password}`
          ).toString("base64");
          headers["Authorization"] = `Basic ${credentials}`;
        }

        // Support custom header name for token (e.g., "x-token")
        if (dataSource.authCredentials?.headerName && dataSource.authCredentials?.token) {
          headers[dataSource.authCredentials.headerName] = dataSource.authCredentials.token;
        }

        // Determine request method (default to GET)
        const method = dataSource.requestTemplate?.method || "GET";

        // Build URL (for GET requests, append billing month as query param)
        let url = dataSource.apiEndpoint;
        if (method === "GET") {
          url = dataSource.apiEndpoint.includes("?")
            ? `${dataSource.apiEndpoint}&period=${billingMonth}`
            : `${dataSource.apiEndpoint}?period=${billingMonth}`;
        } else if (method === "POST") {
          // For POST, resolve tokens in the URL as well
          url = resolveTokens(dataSource.apiEndpoint, billingMonth);
        }

        // Build request options
        const fetchOptions: RequestInit = {
          method,
          headers,
        };

        // Add body for POST requests using bodyTemplate
        if (method === "POST" && dataSource.requestTemplate?.bodyTemplate) {
          const resolvedBody = resolveTokens(dataSource.requestTemplate.bodyTemplate, billingMonth);
          fetchOptions.body = resolvedBody;
        }

        // Determine timeout from retryPolicy or default to 60 seconds
        const timeoutMs = (dataSource.retryPolicy?.timeoutSeconds || 60) * 1000;
        fetchOptions.signal = AbortSignal.timeout(timeoutMs);

        // Execute fetch with retry logic
        const maxRetries = dataSource.retryPolicy?.maxRetries || 0;
        const retryDelayMs = (dataSource.retryPolicy?.retryDelaySeconds || 1) * 1000;

        let lastError: Error | null = null;
        let json: unknown = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
              throw new Error(`Custom API returned ${response.status}`);
            }

            json = await response.json();
            break; // Success, exit retry loop
          } catch (error) {
            lastError = error as Error;
            console.warn(
              `Attempt ${attempt + 1}/${maxRetries + 1} failed for data source ${dataSource.id}:`,
              error
            );

            // If this is the last attempt, don't wait
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            }
          }
        }

        // If all attempts failed and fallbackValues is configured, use fallback
        if (!json && dataSource.fallbackValues) {
          console.log(
            `Using fallback values for data source ${dataSource.id} due to API failure`
          );
          return {
            usageCount: dataSource.fallbackValues.usageCount ?? 0,
            sentCount: dataSource.fallbackValues.sentCount,
            failedCount: dataSource.fallbackValues.failedCount,
          };
        }

        // If all attempts failed and no fallback, return null to indicate failure
        if (!json) {
          throw lastError || new Error("All retry attempts failed");
        }

        // Parse response data based on lineItemMappings or responseMapping
        let usageCount = 0;
        let sentCount: number | undefined;
        let failedCount: number | undefined;

        if (dataSource.lineItemMappings && dataSource.lineItemMappings.length > 0) {
          // Use LineItemProcessor for multi-line data
          const multiLineResults = processMultiLine(json, dataSource.lineItemMappings);

          // Aggregate all line items into single usage count
          // For now, sum up all counts (could be extended to return multiple line items)
          for (const lineResult of multiLineResults) {
            usageCount += lineResult.count;
          }

          // Also extract sent/failed from first line item if available
          if (multiLineResults.length > 0) {
            const firstLine = multiLineResults[0];
            sentCount = firstLine.count; // Use first line's count as sent
            // failedCount can be derived if API provides it
          }
        } else {
          // Fall back to legacy single-line responseMapping
          const singleLineResult = processLegacySingleLine(json, dataSource.responseMapping);
          usageCount = singleLineResult.usageCount;
          sentCount = singleLineResult.sentCount;
          failedCount = singleLineResult.failedCount;
        }

        // Apply fallback if useDefaultOnMissing and values are missing/zero
        if (
          dataSource.fallbackValues?.useDefaultOnMissing &&
          usageCount === 0 &&
          dataSource.fallbackValues.usageCount !== undefined
        ) {
          usageCount = dataSource.fallbackValues.usageCount;
        }

        return { usageCount, sentCount, failedCount };
      }

      default:
        console.warn(`Unknown data source type: ${dataSource.type}`);
        return null;
    }
  } catch (error) {
    console.error(
      `Failed to fetch billable data for data source ${dataSource.id}:`,
      error
    );
    return null;
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

  // Check customer status - skip non-ACTIVE customers
  if (customer.status !== 'ACTIVE') {
    console.log(`Customer ${customerId} has status '${customer.status}', skipping billing`);
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

  // Iterate through each active data source
  for (const dataSource of dataSources) {
    const result = await fetchBillableForDataSource(dataSource, billingMonth);

    if (result) {
      if (result.usageCount > 0) {
        lineItems.push(
          createLineItemFromData(
            dataSource,
            result.usageCount,
            customer,
            result.sentCount,
            result.failedCount
          )
        );
      }
      // If usageCount is 0, skip adding a line item (no charge)
    } else {
      // Fetch failed - add error line item
      lineItems.push(
        createErrorLineItem(
          dataSource,
          customer,
          `Failed to fetch data from ${dataSource.name}`
        )
      );
    }
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
