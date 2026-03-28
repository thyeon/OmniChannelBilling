/**
 * DataSource Client
 *
 * Makes HTTP API calls for configurable data sources.
 * Handles auth, request templating with date substitution, response mapping,
 * retries, and fallbacks.
 */

import { DataSource } from "@/domain/models/dataSource";
import { SingleLineResult } from "@/domain/models/dataSource";

/** Error thrown when a DataSource API call fails. */
export class DataSourceApiError extends Error {
  constructor(
    message: string,
    public readonly dataSourceName: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "DataSourceApiError";
  }
}

/**
 * Parses a billing month string (e.g. "2026-03") into year and month components.
 */
export function parseBillingMonth(billingMonth: string): {
  year: number;
  month: number;
  yearStr: string;
  monthStr: string;
} {
  const [yearStr, monthStr] = billingMonth.split("-");
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    yearStr,
    monthStr,
  };
}

/**
 * Substitutes {year}, {month} placeholders in a string with billing month values.
 * Example: '{"month": {month}, "year": {year}}' → '{"month": 3, "year": 2026}'
 */
function substituteDateVariables(
  template: string,
  billingMonth: string
): string {
  const { year, month, yearStr, monthStr } = parseBillingMonth(billingMonth);
  return template
    .replace(/\{year\}/g, year.toString())
    .replace(/\{month\}/g, month.toString())
    .replace(/\{yearStr\}/g, yearStr)
    .replace(/\{monthStr\}/g, monthStr);
}

/**
 * Extracts a value from a nested JSON object using a dot-path string.
 * Example: getPathValue(obj, "data.0.count") → obj.data[0].count
 */
function getPathValue(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    // Handle array index notation like "0" or "data.0.items"
    const num = Number(segment);
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[segment];
    } else if (Array.isArray(current) && !isNaN(num)) {
      current = current[num];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Calls a DataSource API and returns usage data.
 *
 * @param dataSource - The DataSource configuration
 * @param billingMonth - Billing month in "YYYY-MM" format
 * @returns SingleLineResult with usage counts
 * @throws DataSourceApiError on failure (after all retries exhausted)
 */
export async function fetchDataSourceUsage(
  dataSource: DataSource,
  billingMonth: string
): Promise<SingleLineResult> {
  const { retryPolicy } = dataSource;
  const maxRetries = retryPolicy?.maxRetries ?? 0;
  const retryDelaySeconds = retryPolicy?.retryDelaySeconds ?? 1;
  const timeoutSeconds = retryPolicy?.timeoutSeconds ?? 30;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeRequest(dataSource, billingMonth, timeoutSeconds);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await sleep(retryDelaySeconds * 1000 * Math.pow(2, attempt)); // exponential backoff
      }
    }
  }

  // All retries exhausted — apply fallback or throw
  const fallback = dataSource.fallbackValues;
  if (fallback?.useDefaultOnMissing) {
    return {
      usageCount: fallback.usageCount ?? 0,
      sentCount: fallback.sentCount,
      failedCount: fallback.failedCount,
    };
  }

  throw new DataSourceApiError(
    lastError?.message || `DataSource ${dataSource.name} failed after ${maxRetries + 1} attempts`,
    dataSource.name
  );
}

/**
 * Executes a single HTTP request to the data source.
 */
async function executeRequest(
  dataSource: DataSource,
  billingMonth: string,
  timeoutSeconds: number
): Promise<SingleLineResult> {
  const {
    apiEndpoint,
    authType,
    authCredentials,
    requestTemplate,
    responseMapping,
  } = dataSource;

  const method = requestTemplate?.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(requestTemplate?.headers ?? {}),
  };

  // Build auth headers
  if (authType === "API_KEY" && authCredentials?.key) {
    const headerName = authCredentials.headerName || "X-API-Key";
    headers[headerName] = authCredentials.key;
  } else if (authType === "BEARER_TOKEN" && authCredentials?.token) {
    headers["Authorization"] = `Bearer ${authCredentials.token}`;
  }
  // BASIC_AUTH and NONE: handled below in fetch options

  // Build request init
  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutSeconds * 1000),
  };

  // Build body (only for POST/PUT/PATCH)
  if (method !== "GET" && requestTemplate?.bodyTemplate) {
    const resolvedBody = substituteDateVariables(requestTemplate.bodyTemplate, billingMonth);
    fetchOptions.body = resolvedBody;
  } else if (method !== "GET" && !requestTemplate?.bodyTemplate) {
    // Default body with month/year if no template specified
    const { year, month } = parseBillingMonth(billingMonth);
    fetchOptions.body = JSON.stringify({ month, year });
  }

  // BASIC_AUTH fetch option
  if (authType === "BASIC_AUTH" && authCredentials?.username && authCredentials?.password) {
    const encoded = Buffer.from(
      `${authCredentials.username}:${authCredentials.password}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  let response: Response;
  try {
    response = await fetch(apiEndpoint, fetchOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new DataSourceApiError(
      `Network error calling ${dataSource.name}: ${message}`,
      dataSource.name
    );
  }

  if (!response.ok) {
    throw new DataSourceApiError(
      `${dataSource.name} returned HTTP ${response.status}`,
      dataSource.name,
      response.status
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new DataSourceApiError(
      `${dataSource.name} returned invalid JSON`,
      dataSource.name
    );
  }

  // Extract usage counts via response mapping
  if (!responseMapping) {
    throw new DataSourceApiError(
      `${dataSource.name} has no responseMapping configured`,
      dataSource.name
    );
  }
  const usageCount = getPathValue(data, responseMapping.usageCountPath);
  const sentCount = responseMapping.sentPath
    ? getPathValue(data, responseMapping.sentPath)
    : undefined;
  const failedCount = responseMapping.failedPath
    ? getPathValue(data, responseMapping.failedPath)
    : undefined;

  if (typeof usageCount !== "number") {
    throw new DataSourceApiError(
      `${dataSource.name}: usageCountPath "${responseMapping.usageCountPath}" did not resolve to a number (got ${typeof usageCount})`,
      dataSource.name
    );
  }

  return {
    usageCount,
    sentCount: typeof sentCount === "number" ? sentCount : undefined,
    failedCount: typeof failedCount === "number" ? failedCount : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
