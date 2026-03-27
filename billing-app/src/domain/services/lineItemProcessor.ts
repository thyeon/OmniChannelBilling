/**
 * LineItemProcessor Service
 *
 * Handles multi-line extraction from API responses and legacy single-line processing.
 */

import {
  LineItemMapping,
  MultiLineResult,
  NestedResponseConfig,
  ResponseMapping,
  SingleLineResult,
} from "@/domain/models/dataSource";

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
 * Process multi-line data from API response.
 * Iterates over each entry in lineItemMappings and extracts count/rate data.
 *
 * @param apiResponse - The API response object
 * @param lineItemMappings - Array of mappings defining where to extract each line item's data
 * @returns Array of MultiLineResult objects
 */
export function processMultiLine(
  apiResponse: unknown,
  lineItemMappings: LineItemMapping[]
): MultiLineResult[] {
  const results: MultiLineResult[] = [];

  for (const mapping of lineItemMappings) {
    // Extract count using countPath
    const count = getNestedValue(apiResponse, mapping.countPath) as number;

    // Extract optional rate using ratePath if provided
    const rate = mapping.ratePath
      ? (getNestedValue(apiResponse, mapping.ratePath) as number)
      : undefined;

    results.push({
      lineIdentifier: mapping.lineIdentifier,
      count: count ?? 0,
      rate,
      fallbackRate: mapping.fallbackRate,
    });
  }

  return results;
}

/**
 * Process legacy single-line data from API response (backward compatibility).
 *
 * @param apiResponse - The API response object
 * @param responseMapping - Mapping defining where to extract usage, sent, and failed counts
 * @returns SingleLineResult object
 */
export function processLegacySingleLine(
  apiResponse: unknown,
  responseMapping: ResponseMapping
): SingleLineResult {
  // Extract usageCount using usageCountPath
  const usageCount = getNestedValue(apiResponse, responseMapping.usageCountPath) as number;

  // Extract optional sentCount using sentPath if provided
  const sentCount = responseMapping.sentPath
    ? (getNestedValue(apiResponse, responseMapping.sentPath) as number)
    : undefined;

  // Extract optional failedCount using failedPath if provided
  const failedCount = responseMapping.failedPath
    ? (getNestedValue(apiResponse, responseMapping.failedPath) as number)
    : undefined;

  return {
    usageCount: usageCount ?? 0,
    sentCount,
    failedCount,
  };
}

export interface InglabNestedResult {
  description: string;
  descriptionDetail?: string;
  qty: number;
  unitPrice: number;
  service?: string;
}

export function processInglabNested(
  apiResponse: unknown,
  config: NestedResponseConfig
): InglabNestedResult[] {
  const results: InglabNestedResult[] = [];

  const items = getNestedValue(apiResponse, config.itemsPath);
  if (!Array.isArray(items)) {
    return results;
  }

  for (const item of items) {
    const lineItems = getNestedValue(item, config.lineItemsPath);
    if (!Array.isArray(lineItems)) {
      continue;
    }

    for (const li of lineItems) {
      const qty = getNestedValue(li, config.qtyPath) as number;
      const unitPrice = getNestedValue(li, config.unitPricePath) as number;
      const description = getNestedValue(li, config.descriptionPath) as string;

      if (typeof qty !== "number") {
        continue;
      }

      const descriptionDetail = config.descriptionDetailPath
        ? (getNestedValue(li, config.descriptionDetailPath) as string | undefined)
        : undefined;

      const service = config.servicePath
        ? (getNestedValue(item, config.servicePath) as string | undefined)
        : undefined;

      results.push({
        description: typeof description === "string" ? description : "",
        descriptionDetail,
        qty,
        unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
        service,
      });
    }
  }

  return results;
}