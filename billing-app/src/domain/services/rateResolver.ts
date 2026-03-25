/**
 * Rate Resolver Service
 *
 * Handles rate resolution chain for invoice line items.
 * Priority order:
 * 1. ratePath - extract from API response at specified JSON path
 * 2. fallbackRate - use if defined
 * 3. defaultUnitPrice - use if defined
 * 4. ERROR - rate cannot be resolved
 */

export interface RateResolutionInput {
  ratePath?: string;
  fallbackRate?: number;
  defaultUnitPrice?: number;
  apiResponse: unknown; // the raw API response
}

export interface RateResolutionResult {
  rate: number;
  source: "ratePath" | "fallbackRate" | "defaultUnitPrice";
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
 * Resolve rate using the rate resolution chain.
 *
 * @param input - Rate resolution input containing ratePath, fallbackRate, defaultUnitPrice, and apiResponse
 * @returns RateResolutionResult with rate and source, or null if no rate can be resolved
 */
export function resolveRate(input: RateResolutionInput): RateResolutionResult | null {
  const { ratePath, fallbackRate, defaultUnitPrice, apiResponse } = input;

  // Step 1: Try ratePath from API response
  if (ratePath) {
    const extractedRate = getNestedValue(apiResponse, ratePath);
    if (extractedRate !== null && extractedRate !== undefined && extractedRate !== 0) {
      const numericRate = typeof extractedRate === "number" ? extractedRate : parseFloat(String(extractedRate));
      if (!isNaN(numericRate) && numericRate !== 0) {
        return { rate: numericRate, source: "ratePath" };
      }
    }
  }

  // Step 2: Fall back to fallbackRate
  if (fallbackRate !== undefined && fallbackRate !== null && fallbackRate !== 0) {
    return { rate: fallbackRate, source: "fallbackRate" };
  }

  // Step 3: Fall back to defaultUnitPrice
  if (defaultUnitPrice !== undefined && defaultUnitPrice !== null && defaultUnitPrice !== 0) {
    return { rate: defaultUnitPrice, source: "defaultUnitPrice" };
  }

  // Step 4: No rate available
  return null;
}