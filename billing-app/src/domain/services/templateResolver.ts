/**
 * Invoice Template Resolver
 *
 * Resolves placeholder tokens in description templates against actual billing data.
 * Used for both master.description and details[].furtherDescription.
 *
 * Resolution order: customer override → account book default → hardcoded fallback.
 */

import { InvoiceLineItem } from "@/types";

/** Context passed to the template resolver at invoice build time. */
export interface TemplateContext {
  billingMonth: string;
  customerName: string;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
}

/** Default templates used when neither customer nor account book provides one. */
export const DEFAULT_INVOICE_DESCRIPTION_TEMPLATE =
  "SMS Billing - {BillingCycle}";

export const DEFAULT_FURTHER_DESCRIPTION_TEMPLATE =
  "For {BillingCycle}, the total number of SMS messages sent via ECS Service was {SMSCount}, charged at {SMSRate} per message.";

/**
 * Format a billing month string (e.g. "2026-01") into a human-readable form (e.g. "January 2026").
 */
function formatBillingCycle(billingMonth: string): string {
  const [year, month] = billingMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

/**
 * Format a number to fixed decimal places (e.g. 0.079 → "0.0790").
 * Users can add currency prefix (e.g. "RM") in their template text.
 */
function formatCurrency(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Extract a line item for a given service type, returning zeros if not found.
 */
function getServiceData(
  lineItems: InvoiceLineItem[],
  service: string
): { count: number; rate: number; total: number } {
  const item = lineItems.find(
    (li) => li.service.toUpperCase() === service.toUpperCase()
  );
  if (!item) return { count: 0, rate: 0, total: 0 };
  return {
    count: item.billableCount,
    rate: item.rate,
    total: item.totalCharge,
  };
}

/**
 * Resolve a template string by replacing all `{Placeholder}` tokens
 * with actual values from the billing context.
 *
 * Supported placeholders:
 *   {BillingCycle}     → "January 2026"
 *   {CustomerName}     → "Coway (M) Sdn Bhd"
 *   {TotalAmount}      → "RM 5.21"
 *   {SMSCount}         → "66"
 *   {SMSRate}          → "RM 0.079"
 *   {SMSTotal}         → "RM 5.21"
 *   {EmailCount}       → "1200"
 *   {EmailRate}        → "RM 0.02"
 *   {EmailTotal}       → "RM 24.00"
 *   {WhatsAppCount}    → "500"
 *   {WhatsAppRate}     → "RM 0.08"
 *   {WhatsAppTotal}    → "RM 40.00"
 */
export function resolveTemplate(
  template: string,
  context: TemplateContext
): string {
  const sms = getServiceData(context.lineItems, "SMS");
  const email = getServiceData(context.lineItems, "EMAIL");
  const whatsapp = getServiceData(context.lineItems, "WHATSAPP");

  const replacements: Record<string, string> = {
    "{BillingCycle}": formatBillingCycle(context.billingMonth),
    "{CustomerName}": context.customerName,
    "{TotalAmount}": formatCurrency(context.totalAmount),
    "{SMSCount}": sms.count.toLocaleString(),
    "{SMSRate}": formatCurrency(sms.rate, 4),
    "{SMSTotal}": formatCurrency(sms.total),
    "{EmailCount}": email.count.toLocaleString(),
    "{EmailRate}": formatCurrency(email.rate, 4),
    "{EmailTotal}": formatCurrency(email.total),
    "{WhatsAppCount}": whatsapp.count.toLocaleString(),
    "{WhatsAppRate}": formatCurrency(whatsapp.rate, 4),
    "{WhatsAppTotal}": formatCurrency(whatsapp.total),
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }
  return result;
}
