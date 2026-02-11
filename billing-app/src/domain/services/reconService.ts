import { Customer, ServiceType, ConnectionStatus } from "@/types";
import { MappedReconData } from "@/domain/models/reconResponse";
import {
  fetchReconSummary,
  fetchEmailReconSummary,
  ReconApiError,
} from "@/infrastructure/external/reconClient";

/** Result of fetching recon data for a single service. */
export interface ReconFetchResult {
  service: ServiceType;
  connectionStatus: ConnectionStatus;
  reconServerName: string;
  data: MappedReconData | null;
  error?: string;
}

/**
 * Maps a raw ReconApiResponse to the app's internal MappedReconData shape.
 *
 * Mapping:
 *   total            → reconTotal
 *   successCount     → reconDetails.sent
 *   failed           → reconDetails.failed
 *   notReqToServiceProvider → reconDetails.withheld
 */
function mapReconResponse(raw: {
  total: number;
  successCount: number;
  failed: number;
  notReqToServiceProvider: number;
}): MappedReconData {
  return {
    reconTotal: raw.total,
    reconDetails: {
      sent: raw.successCount,
      failed: raw.failed,
      withheld: raw.notReqToServiceProvider,
    },
  };
}

/**
 * Maps a raw EmailReconApiResponse to MappedReconData.
 * Email recon only provides a total count — no sent/failed/withheld breakdown.
 */
function mapEmailReconResponse(raw: { count: number }): MappedReconData {
  return {
    reconTotal: raw.count,
    reconDetails: {
      sent: raw.count,
      failed: 0,
      withheld: 0,
    },
  };
}

/**
 * Fetches reconciliation data for a specific service of a customer.
 * Finds the matching ReconServer from the customer config and calls the API.
 * Routes to the correct adapter based on reconServer.apiFormat.
 */
export async function fetchReconDataForService(
  customer: Customer,
  service: ServiceType,
  billingMonth: string
): Promise<ReconFetchResult> {
  const reconServer = customer.reconServers.find((r) => r.type === service);

  if (!reconServer) {
    return {
      service,
      connectionStatus: "NOT_CONFIGURED",
      reconServerName: "",
      data: null,
      error: `No recon server configured for ${service}`,
    };
  }

  try {
    let mapped: MappedReconData;

    if (reconServer.apiFormat === "EMAIL_RECON") {
      const response = await fetchEmailReconSummary(reconServer, billingMonth);
      mapped = mapEmailReconResponse(response);
    } else {
      const response = await fetchReconSummary(reconServer, billingMonth);
      mapped = mapReconResponse(response);
    }

    return {
      service,
      connectionStatus: "SUCCESS",
      reconServerName: reconServer.name,
      data: mapped,
    };
  } catch (error) {
    const message =
      error instanceof ReconApiError
        ? error.message
        : "Unknown error fetching recon data";

    return {
      service,
      connectionStatus: "FAILED",
      reconServerName: reconServer.name,
      data: null,
      error: message,
    };
  }
}

/**
 * Fetches reconciliation data for all services of a customer.
 * Returns one ReconFetchResult per service.
 */
export async function fetchReconDataForAllServices(
  customer: Customer,
  billingMonth: string
): Promise<ReconFetchResult[]> {
  const results = await Promise.all(
    customer.services.map((service) =>
      fetchReconDataForService(customer, service, billingMonth)
    )
  );
  return results;
}
