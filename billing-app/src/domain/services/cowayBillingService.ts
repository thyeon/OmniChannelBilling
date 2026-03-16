/**
 * Coway Billing Service
 *
 * Fetches billable data for Coway (Malaysia) Sdn Bhd - SMS, WhatsApp, and Email.
 * Returns structured InvoiceLineItem[] for use in AutoCount invoice generation.
 */

import { Customer, InvoiceLineItem, ServiceType, ConnectionStatus } from "@/types";
import { fetchCowayBillable, fetchWhatsAppBillable } from "@/infrastructure/external/cowayClient";
import { fetchEmailReconSummary } from "@/infrastructure/external/reconClient";
import { findCustomerById, findAllCustomers } from "@/infrastructure/db/customerRepository";

const COWAY_CUSTOMER_NAME = "Coway (Malaysia) Sdn Bhd";

interface BillableDataResult {
  customer: Customer | null;
  lineItems: InvoiceLineItem[];
}

/**
 * Find customer by name (utility function)
 */
async function findCustomerByName(name: string): Promise<Customer | null> {
  const customers = await findAllCustomers();
  return customers.find((c) => c.name === name) || null;
}

/**
 * Fetch billable data for Coway customer.
 *
 * @param billingMonth - Format: "2026-03"
 * @returns Object containing customer config and invoice line items
 */
export async function fetchCowayBillableData(
  billingMonth: string
): Promise<BillableDataResult> {
  // Get customer config from MongoDB
  const customer = await findCustomerByName(COWAY_CUSTOMER_NAME);

  if (!customer) {
    return {
      customer: null,
      lineItems: [],
    };
  }

  const lineItems: InvoiceLineItem[] = [];

  // Fetch SMS data from Coway API
  try {
    const smsData = await fetchCowayBillable(billingMonth);
    if (smsData.length > 0) {
      const smsItem = smsData[0];
      const smsCount = smsItem.line_items[0]?.qty || 0;
      const smsRate = customer.rates?.SMS || 0;

      if (smsCount > 0) {
        lineItems.push({
          service: "SMS" as ServiceType,
          hasProvider: true,
          reconServerStatus: "SUCCESS" as ConnectionStatus,
          providerStatus: "SUCCESS" as ConnectionStatus,
          reconServerName: "Coway API",
          providerName: "GTS",
          reconTotal: smsCount,
          reconDetails: {
            sent: smsCount,
            failed: 0,
            withheld: 0,
          },
          providerTotal: smsCount,
          discrepancyPercentage: 0,
          isMismatch: false,
          thresholdUsed: customer.discrepancyThreshold || 0,
          billableCount: smsCount,
          wasOverridden: false,
          rate: smsRate,
          totalCharge: smsCount * smsRate,
        });
      }
    }
  } catch (error) {
    console.error("Failed to fetch SMS billable data:", error);
    // Add SMS line item with error status
    lineItems.push(createEmptyLineItem("SMS", customer, "Failed to fetch SMS data"));
  }

  // Fetch WhatsApp data from WHATSAPP recon server
  const whatsappReconServer = customer.reconServers?.find(
    (r) => r.type === "WHATSAPP"
  );

  if (whatsappReconServer) {
    try {
      const whatsappCount = await fetchWhatsAppBillable(billingMonth, {
        apiEndpoint: whatsappReconServer.apiEndpoint,
        userId: whatsappReconServer.userId,
        apiKey: whatsappReconServer.apiKey,
      });

      if (whatsappCount > 0) {
        const whatsappRate = customer.rates?.WHATSAPP || 0;

        lineItems.push({
          service: "WHATSAPP" as ServiceType,
          hasProvider: true,
          reconServerStatus: "SUCCESS" as ConnectionStatus,
          providerStatus: "SUCCESS" as ConnectionStatus,
          reconServerName: whatsappReconServer.name,
          providerName: "Ali",
          reconTotal: whatsappCount,
          reconDetails: {
            sent: whatsappCount,
            failed: 0,
            withheld: 0,
          },
          providerTotal: whatsappCount,
          discrepancyPercentage: 0,
          isMismatch: false,
          thresholdUsed: customer.discrepancyThreshold || 0,
          billableCount: whatsappCount,
          wasOverridden: false,
          rate: whatsappRate,
          totalCharge: whatsappCount * whatsappRate,
        });
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp billable data:", error);
      lineItems.push(createEmptyLineItem("WHATSAPP", customer, "Failed to fetch WhatsApp data"));
    }
  } else {
    // No WhatsApp recon server configured
    lineItems.push(createEmptyLineItem("WHATSAPP", customer, "No WhatsApp recon server configured"));
  }

  // Fetch Email data from recon server
  const emailReconServer = customer.reconServers?.find(
    (r) => r.type === "EMAIL"
  );

  if (emailReconServer) {
    try {
      const emailData = await fetchEmailReconSummary(emailReconServer, billingMonth);
      const emailCount = emailData.count || 0;

      if (emailCount > 0) {
        const emailRate = customer.rates?.EMAIL || 0;

        lineItems.push({
          service: "EMAIL" as ServiceType,
          hasProvider: true,
          reconServerStatus: "SUCCESS" as ConnectionStatus,
          providerStatus: "SUCCESS" as ConnectionStatus,
          reconServerName: emailReconServer.name,
          providerName: "Email Provider",
          reconTotal: emailCount,
          reconDetails: {
            sent: emailCount,
            failed: 0,
            withheld: 0,
          },
          providerTotal: emailCount,
          discrepancyPercentage: 0,
          isMismatch: false,
          thresholdUsed: customer.discrepancyThreshold || 0,
          billableCount: emailCount,
          wasOverridden: false,
          rate: emailRate,
          totalCharge: emailCount * emailRate,
        });
      }
    } catch (error) {
      console.error("Failed to fetch Email billable data:", error);
      lineItems.push(createEmptyLineItem("EMAIL", customer, "Failed to fetch Email data"));
    }
  } else {
    // No Email recon server configured
    lineItems.push(createEmptyLineItem("EMAIL", customer, "No Email recon server configured"));
  }

  return {
    customer,
    lineItems,
  };
}

/**
 * Create an empty/error line item for a service type
 */
function createEmptyLineItem(
  serviceType: ServiceType,
  customer: Customer,
  errorMessage: string
): InvoiceLineItem {
  const rate = customer.rates?.[serviceType] || 0;

  return {
    service: serviceType,
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
 * Fetch billable data for a specific customer by customer ID.
 * Used when generating invoice for a specific customer (not just Coway).
 *
 * @param customerId - Customer ID
 * @param billingMonth - Format: "2026-03"
 * @returns Object containing customer config and invoice line items
 */
export async function fetchBillableDataByCustomerId(
  customerId: string,
  billingMonth: string
): Promise<BillableDataResult> {
  const customer = await findCustomerById(customerId);

  if (!customer) {
    return {
      customer: null,
      lineItems: [],
    };
  }

  // For now, only Coway is supported for direct invoice generation
  // This can be extended to support other customers
  if (customer.name === COWAY_CUSTOMER_NAME) {
    return fetchCowayBillableData(billingMonth);
  }

  // For other customers, return empty for now
  return {
    customer,
    lineItems: [],
  };
}
