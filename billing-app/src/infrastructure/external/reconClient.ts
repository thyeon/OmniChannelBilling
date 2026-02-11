import { ReconServer } from "@/types";
import { ReconApiResponse, EmailReconApiResponse } from "@/domain/models/reconResponse";

/** Error thrown when a Recon API call fails. */
export class ReconApiError extends Error {
  constructor(
    message: string,
    public readonly serverName: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ReconApiError";
  }
}

/**
 * Computes dtFrom and dtTo for a given billing month string (e.g. "2026-01").
 * dtFrom = first day of month at 00:00:00
 * dtTo   = last day of month at 23:59:59
 */
export function computeDateRange(billingMonth: string): {
  dtFrom: string;
  dtTo: string;
} {
  const [yearStr, monthStr] = billingMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // day 0 of next month = last day of current

  const pad = (n: number): string => n.toString().padStart(2, "0");

  const dtFrom = `${year}-${pad(month)}-${pad(firstDay.getDate())} 00:00:00`;
  const dtTo = `${year}-${pad(month)}-${pad(lastDay.getDate())} 23:59:59`;

  return { dtFrom, dtTo };
}

/**
 * Calls a Reconciliation Server API to fetch usage summary data.
 *
 * @param reconServer - The ReconServer config (userId, apiKey, apiEndpoint)
 * @param billingMonth - Billing month in "YYYY-MM" format
 * @returns The parsed ReconApiResponse
 * @throws ReconApiError on network, timeout, or API-level failure
 */
export async function fetchReconSummary(
  reconServer: ReconServer,
  billingMonth: string
): Promise<ReconApiResponse> {
  const { dtFrom, dtTo } = computeDateRange(billingMonth);

  const requestBody = {
    user: reconServer.userId,
    secret: reconServer.apiKey,
    dtFrom,
    dtTo,
  };

  let response: Response;
  try {
    response = await fetch(reconServer.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new ReconApiError(
      `Network error calling ${reconServer.name}: ${message}`,
      reconServer.name
    );
  }

  if (!response.ok) {
    throw new ReconApiError(
      `${reconServer.name} returned HTTP ${response.status}`,
      reconServer.name,
      response.status
    );
  }

  let data: ReconApiResponse;
  try {
    data = await response.json();
  } catch {
    throw new ReconApiError(
      `${reconServer.name} returned invalid JSON`,
      reconServer.name
    );
  }

  if (!data.success) {
    throw new ReconApiError(
      `${reconServer.name} reported failure (success=false)`,
      reconServer.name
    );
  }

  return data;
}

/**
 * Calls an Email Reconciliation Server API to fetch sent count.
 *
 * @param reconServer - The ReconServer config (apiKey = x-token, apiEndpoint)
 * @param billingMonth - Billing month in "YYYY-MM" format
 * @returns The parsed EmailReconApiResponse
 * @throws ReconApiError on network, timeout, or API-level failure
 */
export async function fetchEmailReconSummary(
  reconServer: ReconServer,
  billingMonth: string
): Promise<EmailReconApiResponse> {
  const [yearStr, monthStr] = billingMonth.split("-");
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  const requestBody = { month, year };

  let response: Response;
  try {
    response = await fetch(reconServer.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-token": reconServer.apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new ReconApiError(
      `Network error calling ${reconServer.name}: ${message}`,
      reconServer.name
    );
  }

  if (!response.ok) {
    throw new ReconApiError(
      `${reconServer.name} returned HTTP ${response.status}`,
      reconServer.name,
      response.status
    );
  }

  let data: EmailReconApiResponse;
  try {
    data = await response.json();
  } catch {
    throw new ReconApiError(
      `${reconServer.name} returned invalid JSON`,
      reconServer.name
    );
  }

  // Check for auth error (API returns 200 with message on invalid token)
  if (data.message) {
    throw new ReconApiError(
      `${reconServer.name}: ${data.message}`,
      reconServer.name
    );
  }

  return data;
}
