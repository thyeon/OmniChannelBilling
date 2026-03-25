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

interface BillableDataResult {
  customer: Customer | null;
  lineItems: InvoiceLineItem[];
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

        // Build request with billing month
        const url = dataSource.apiEndpoint.includes("?")
          ? `${dataSource.apiEndpoint}&period=${billingMonth}`
          : `${dataSource.apiEndpoint}?period=${billingMonth}`;

        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          throw new Error(`Custom API returned ${response.status}`);
        }

        const json = await response.json();

        // Parse usage count from response using responseMapping
        const usageCount =
          (getNestedValue(json, dataSource.responseMapping.usageCountPath) as number) ||
          0;

        // Optional: parse sent/failed counts
        const sentCount = dataSource.responseMapping.sentPath
          ? (getNestedValue(json, dataSource.responseMapping.sentPath) as number)
          : undefined;
        const failedCount = dataSource.responseMapping.failedPath
          ? (getNestedValue(json, dataSource.responseMapping.failedPath) as number)
          : undefined;

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
