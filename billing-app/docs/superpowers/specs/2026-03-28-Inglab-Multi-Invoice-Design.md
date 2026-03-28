# INGLAB Multi-Invoice Generation — Design Spec

> **For agentic workers:** Implementation uses `superpowers:writing-plans` to create the execution plan, then `superpowers:subagent-driven-development` to implement task-by-task.

**Goal:** Generate multiple AutoCount invoices per customer per billing period when INGLAB returns multiple `service_id` groups.

---

## Context

INGLAB's per-customer API returns multiple `items[]` entries for the same customer + billing period, each representing a different WhatsApp business account:

| Entry | `service_id` | `project_name` |
|---|---|---|
| 0 | `ZURICH-001,ZURICH-001-1` | Policy Inquiry Bot |
| 1 | `ZURICH-002,ZURICH-002-1` | Virtual Assistant |
| 2 | `ZURICH-003,ZURICH-003-1` | One Way Blast |

Each entry contains usage lines (`ZURICH-001`) paired with a platform fee line (`ZURICH-001-1`). The current system flattens all entries into a single invoice — losing project separation.

---

## Architecture

**Approach A:** Group at the API route level. Non-INGLAB paths (COWAY_API, RECON_SERVER) are unchanged.

```
generateBillableData → flat InvoiceLineItem[]
        ↓
API route: group by serviceId
        ↓
Loop per group:
  buildAutoCountInvoice (with serviceId, projectName)
        ↓
  insertInvoice → MongoDB
```

---

## New Fields

### InvoiceLineItem (INGLAB only)

```typescript
interface InvoiceLineItem {
  // ... existing fields

  // NEW — populated by processInglabNested for INGLAB data
  serviceId?: string;      // e.g., "ZURICH-001" — from line_item.service_id
  projectName?: string;   // e.g., "Policy Inquiry Bot" — from item.project_name
}
```

### Invoice document (MongoDB)

```typescript
interface Invoice {
  // ... existing fields

  // NEW
  serviceId?: string;         // e.g., "ZURICH-001"
  projectName?: string;        // e.g., "Policy Inquiry Bot"
}
```

---

## Detailed Changes

### 1. `lineItemProcessor.ts` — `processInglabNested`

**Input:** INGLAB API response (`items[]`)

**Output:** `InglabNestedResult[]` with `serviceId` and `projectName` populated per line item.

**Logic:**
- For each `item` in `items[]`:
  - Extract `item.project_name` → propagate to all line items
  - Extract `item.service_id` → parse comma-separated string → for each `line_item`:
    - Map `line_item.service_id` → `serviceId` on result
    - Map `line_item.description` → `description` on result
    - Map `line_item.description_detail` → `descriptionDetail` on result
    - Map `line_item.qty` → `qty` on result
    - Map `line_item.unit_price` → `unitPrice` on result (already in MYR)

```typescript
export interface InglabNestedResult {
  serviceId: string;       // NEW
  projectName: string;     // NEW
  description: string;
  descriptionDetail?: string;
  qty: number;
  unitPrice?: number;
  service?: string;
}
```

### 2. `billingService.ts`

No changes. `fetchBillableForDataSource` returns `InvoiceLineItem[]` with `serviceId` and `projectName` now populated.

### 3. `/api/invoices/generate/generic/route.ts`

**New logic after `generateBillableData`:**

```typescript
const { customer, lineItems } = billableResult;

// Filter to active, non-skipped items
const activeLineItems = lineItems.filter(
  (li) => !li.reconServerStatus || li.reconServerStatus !== "FAILED"
);

// Group INGLAB items by serviceId (non-INGLAB items have no serviceId)
const groups = new Map<string, InvoiceLineItem[]>();
for (const li of activeLineItems) {
  const key = li.serviceId || "DEFAULT"; // "DEFAULT" for non-INGLAB sources
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(li);
}

// Generate one invoice per group
const invoices = [];
for (const [serviceId, groupItems] of groups) {
  const projectName = groupItems[0]?.projectName || "";

  const { invoice, payload } = await buildAutoCountInvoice({
    customer,
    billingMonth,
    lineItems: groupItems,
    serviceId,     // passed to override master.description
    projectName,   // passed for description enrichment
  });

  const docNo = await syncToAutoCount(payload);
  const saved = await insertInvoice({
    ...invoice,
    serviceId,
    projectName,
    autocountRefId: docNo,
  });
  invoices.push(saved);
}

return Response.json({ invoices, billingMonth, customerId });
```

### 4. `autocountInvoiceBuilder.ts` — `buildAutoCountInvoice`

**Signature change:**
```typescript
async function buildAutoCountInvoice(
  customer: Customer,
  billingMonth: string,
  lineItems: InvoiceLineItem[],
  serviceId?: string,    // NEW
  projectName?: string    // NEW
): Promise<{ invoice: Invoice; payload: AutoCountInvoicePayload }>
```

**`master.description`** — override when `serviceId` and `projectName` are provided:
```
"{CustomerName} — {serviceId} — {projectName} — {BillingCycle}"
// e.g., "Zurich Malaysia — ZURICH-001 — Policy Inquiry Bot — February 2026"
```

```typescript
let resolvedInvoiceDescription: string;
if (serviceId && projectName) {
  resolvedInvoiceDescription = `${customer.name} — ${serviceId} — ${projectName} — ${billingMonth}`;
} else {
  const template =
    customer.invoiceDescriptionTemplate ||
    accountBook.invoiceDescriptionTemplate ||
    DEFAULT_INVOICE_DESCRIPTION_TEMPLATE;
  resolvedInvoiceDescription = resolveTemplate(template, templateContext);
}
```

**Platform Fee `description`** — when `lineIdentifier` contains "Monthly Platform Fee":
```
"WhatsApp Business API Monthly Platform Fee - {projectName} - {billingMonth}"
// e.g., "WhatsApp Business API Monthly Platform Fee - Policy Inquiry Bot - 2026-02"
```

```typescript
if (lineItem.lineIdentifier?.includes("Monthly Platform Fee") && projectName) {
  resolvedDescription = `WhatsApp Business API Monthly Platform Fee - ${projectName} - ${billingMonth}`;
}
```

**Platform Fee `furtherDescription`** — use INGLAB's `descriptionDetail` when present:
```typescript
if (lineItem.descriptionDetail) {
  resolvedFurtherDesc = lineItem.descriptionDetail; // "• Billing period: February 2026"
}
```

**`furtherDescription` for usage lines** — INGLAB's `descriptionDetail` (exchange rate info) takes priority over template:
```typescript
if (lineItem.descriptionDetail) {
  resolvedFurtherDesc = lineItem.descriptionDetail;
} else {
  // use template as before
}
```

### 5. `types/index.ts` — `Invoice` type

Add new fields:
```typescript
interface Invoice {
  // ... existing fields
  serviceId?: string;         // NEW: e.g., "ZURICH-001"
  projectName?: string;       // NEW: e.g., "Policy Inquiry Bot"
}
```

---

## Behavior Summary

| Scenario | Behavior |
|---|---|
| INGLAB: multiple serviceId groups | One AutoCount invoice per `serviceId`, each stored separately in MongoDB |
| Non-INGLAB data sources | Single invoice, same as before |
| Zero-qty lines (Authentication) | Included in invoice (audit trail, zero charge) |
| `unitPrice` | Used as-is from INGLAB (already MYR, no FX conversion needed) |
| Product code | Keep `MODE-WA-API` / `MODE-WA-PLATFORM` (per lineIdentifier logic) |
| Platform Fee `furtherDescription` | Use INGLAB's `descriptionDetail`: "• Billing period: February 2026" |
| Platform Fee `description` | Append `projectName`: "WhatsApp Business API Monthly Platform Fee - Policy Inquiry Bot - 2026-02" |
| `master.description` | Use `serviceId` + `projectName`: "Zurich Malaysia — ZURICH-001 — Policy Inquiry Bot — February 2026" |
