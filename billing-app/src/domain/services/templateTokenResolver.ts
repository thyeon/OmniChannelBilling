/**
 * Template Token Resolver
 *
 * Resolves billing month tokens in URLs and POST body templates.
 * Used for dynamic customer configuration to inject billing period values.
 *
 * Supported tokens:
 *   {billingMonth} → YYYY-MM (e.g., "2026-03")
 *   {month}       → Month number without leading zero (e.g., "3")
 *   {year}        → Full year (e.g., "2026")
 */

/**
 * Check if a string is in valid YYYY-MM format.
 */
function isValidBillingMonthFormat(billingMonth: string): boolean {
  const pattern = /^\d{4}-(0[1-9]|1[0-2])$/;
  return pattern.test(billingMonth);
}

/**
 * Extract year and month from a valid billing month string.
 */
function parseBillingMonth(
  billingMonth: string
): { year: string; month: string } | null {
  if (!isValidBillingMonthFormat(billingMonth)) {
    return null;
  }

  const [year, monthRaw] = billingMonth.split("-");
  const month = String(parseInt(monthRaw, 10)); // strip leading zero, e.g. "03" → "3"
  return { year, month };
}

/**
 * Resolve tokens in a template string using the provided billing month.
 *
 * @param template - The template string containing tokens (e.g., "https://api.example.com?period={billingMonth}")
 * @param billingMonth - The billing month in YYYY-MM format (e.g., "2026-03")
 * @returns The template with all tokens resolved. If billingMonth is invalid, returns the template unchanged.
 *
 * @example
 * resolveTokens("period={billingMonth}", "2026-03") // => "period=2026-03"
 * resolveTokens('{"month": "{month}", "year": "{year}"}', "2026-03") // => '{"month": "3", "year": "2026"}'
 * resolveTokens("https://api.example.com?from={year}-01-01&to={billingMonth}-31", "2026-03")
 * // => "https://api.example.com?from=2026-01-01&to=2026-03-31"
 */
export function resolveTokens(template: string, billingMonth: string): string {
  // Validate billing month format - if invalid, return template unchanged
  const parsed = parseBillingMonth(billingMonth);
  if (!parsed) {
    return template;
  }

  const { year, month } = parsed;

  // Replace all tokens
  const replacements: Record<string, string> = {
    "{billingMonth}": billingMonth,
    "{month}": month, // month is already without leading zero from split
    "{year}": year,
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }

  return result;
}
