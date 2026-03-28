# INGLAB Multi-Invoice Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:dispatching-parallel-agents` to implement all tasks concurrently, then `superpowers:subagent-driven-development` for integration if needed.

**Goal:** Generate multiple AutoCount invoices per customer per billing period when INGLAB returns multiple `service_id` groups.

**Architecture:** Group line items by `serviceId` at the API route level. Each group gets its own AutoCount invoice with enriched descriptions. Non-INGLAB paths are unchanged.

**Tech Stack:** TypeScript, Next.js API routes, MongoDB, AutoCount API

---

## File Structure

| File | Responsibility |
|---|---|
| `src/domain/models/dataSource.ts` | Add `serviceIdPath` and `projectNamePath` to `NestedResponseConfig` |
| `src/domain/services/lineItemProcessor.ts` | Extract `serviceId` and `projectName` per line item |
| `src/types/index.ts` | Add `serviceId?`/`projectName?` to `InvoiceLineItem` and `InvoiceHistory` |
| `src/domain/services/autocountInvoiceBuilder.ts` | Accept `serviceId?`/`projectName?`, override descriptions |
| `src/app/api/invoices/generate/generic/route.ts` | Group by `serviceId`, loop per group |

---

## Task 1: Extend NestedResponseConfig and processInglabNested

**Files:**
- Modify: `src/domain/models/dataSource.ts:125-133`
- Modify: `src/domain/services/lineItemProcessor.ts:127-186`

**Details:**
- Add `serviceIdPath?: string` to `NestedResponseConfig` — path to `line_items[].service_id` (e.g., `"service_id"`)
- Add `projectNamePath?: string` to `NestedResponseConfig` — path to `item.project_name` (e.g., `"project_name"`)
- Add `serviceId: string` and `projectName: string` to `InglabNestedResult` interface
- In `processInglabNested`: extract `item[projectNamePath]` before the line-items loop, extract `li[serviceIdPath]` per line item, propagate both to results

```typescript
// dataSource.ts
export interface NestedResponseConfig {
  itemsPath: string;
  lineItemsPath: string;
  descriptionPath: string;
  descriptionDetailPath?: string;
  qtyPath: string;
  unitPricePath: string;
  servicePath?: string;
  serviceIdPath?: string;    // NEW: line_items[].service_id
  projectNamePath?: string;  // NEW: item.project_name
}

// lineItemProcessor.ts
export interface InglabNestedResult {
  serviceId: string;     // NEW
  projectName: string;   // NEW
  description: string;
  descriptionDetail?: string;
  qty: number;
  unitPrice?: number;
  service?: string;
}

// In processInglabNested loop:
const projectName = config.projectNamePath
  ? (getNestedValue(item, config.projectNamePath) as string | undefined)?.toString() ?? ""
  : "";

for (const li of lineItems) {
  const serviceId = config.serviceIdPath
    ? (getNestedValue(li, config.serviceIdPath) as string | undefined)?.toString() ?? ""
    : "";

  results.push({
    serviceId,         // NEW
    projectName,       // NEW
    description: typeof description === "string" ? description : "",
    descriptionDetail,
    qty,
    unitPrice: typeof unitPrice === "number" ? unitPrice : undefined,
    service,
  });
}
```

---

## Task 2: Add serviceId/projectName to InvoiceLineItem and InvoiceHistory types

**Files:**
- Modify: `src/types/index.ts`

**Details:**
- Add `serviceId?: string` and `projectName?: string` to `InvoiceLineItem` interface (near existing `unitPrice`, `description`, `descriptionDetail` fields)
- Add `serviceId?: string` and `projectName?: string` to `InvoiceHistory` interface (near `autocountRefId`, `syncError`)

```typescript
// InvoiceLineItem — add after descriptionDetail
serviceId?: string;       // e.g., "ZURICH-001" — from line_item.service_id
projectName?: string;     // e.g., "Policy Inquiry Bot" — from item.project_name

// InvoiceHistory — add after syncError
serviceId?: string;        // e.g., "ZURICH-001"
projectName?: string;      // e.g., "Policy Inquiry Bot"
```

---

## Task 3: Extend buildAutoCountInvoice with serviceId/projectName

**Files:**
- Modify: `src/domain/services/autocountInvoiceBuilder.ts`

**Details:**
- Change `BuildInvoiceOptions` interface to accept optional `serviceId?: string` and `projectName?: string`
- `master.description` override: if `serviceId` and `projectName` are provided, use `"${customer.name} — ${serviceId} — ${projectName} — ${billingMonth}"` instead of template
- Platform Fee description: if `lineIdentifier` includes "Monthly Platform Fee" and `projectName` is set, use `"WhatsApp Business API Monthly Platform Fee - ${projectName} - ${billingMonth}"`
- `furtherDescription` for usage lines: if `lineItem.descriptionDetail` is present, use it as-is (already implemented — verify it's still in place)
- Platform Fee `furtherDescription`: if `lineItem.descriptionDetail` is present, use it as-is

```typescript
// BuildInvoiceOptions
interface BuildInvoiceOptions {
  customer: Customer;
  billingMonth: string;
  lineItems: InvoiceLineItem[];
  serviceId?: string;    // NEW
  projectName?: string;   // NEW
}

// master.description override (replace existing template resolution)
let resolvedInvoiceDescription: string;
if (serviceId && projectName) {
  resolvedInvoiceDescription = `${customer.name} — ${serviceId} — ${projectName} — ${billingMonth}`;
} else {
  const template = customer.invoiceDescriptionTemplate
    || accountBook.invoiceDescriptionTemplate
    || DEFAULT_INVOICE_DESCRIPTION_TEMPLATE;
  resolvedInvoiceDescription = resolveTemplate(template, templateContext);
}

// Platform Fee description (insert in the line-item loop, before resolvedDescription)
if (lineItem.lineIdentifier?.includes("Monthly Platform Fee") && projectName) {
  resolvedDescription = `WhatsApp Business API Monthly Platform Fee - ${projectName} - ${billingMonth}`;
} else {
  resolvedDescription = lineItem.description
    ? `${lineItem.description} - ${billingMonth}`
    : lineDescription;
}
```

---

## Task 4: Update generic generate route to group by serviceId

**Files:**
- Modify: `src/app/api/invoices/generate/generic/route.ts`

**Details:**
- After `generateBillableData`, filter active line items (non-FAILED)
- Group by `serviceId` (non-INGLAB → `"DEFAULT"`)
- Loop per group: build, insert, (mock or sync)
- Pass `serviceId`/`projectName` to `buildAutoCountInvoice`
- Store `serviceId`/`projectName` on each MongoDB invoice document
- Return `{ invoices: [], billingMonth, customerId }`

**Critical:** Preserve existing non-INGLAB behavior — only INGLAB items have `serviceId`, so non-INGLAB sources get the `"DEFAULT"` group and behave exactly as before.

```typescript
// After generateBillableData
const { customer, lineItems } = billableResult;

const activeLineItems = lineItems.filter(
  (li) => !li.reconServerStatus || li.reconServerStatus !== "FAILED"
);

// Group by serviceId
const groups = new Map<string, InvoiceLineItem[]>();
for (const li of activeLineItems) {
  const key = li.serviceId || "DEFAULT";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(li);
}

// Loop per group
const invoices = [];
for (const [serviceId, groupItems] of groups) {
  const projectName = groupItems[0]?.projectName || "";

  const buildResult = await buildAutoCountInvoice({
    customer,
    billingMonth,
    lineItems: groupItems,
    serviceId,
    projectName,
  });

  if (!buildResult.success || !buildResult.payload) {
    const errorInvoice: InvoiceHistory = {
      id: `inv-${Date.now()}`,
      customerId,
      customerName: customer.name,
      billingMonth,
      totalAmount: groupItems.reduce((s, li) => s + li.totalCharge, 0),
      status: "ERROR",
      syncError: buildResult.error,
      createdAt: new Date().toISOString(),
      billingMode: customer.billingMode,
      schedule: customer.schedule,
      generatedBy: "MANUAL",
      lineItems: groupItems,
      serviceId,
      projectName,
    };
    await insertInvoice(errorInvoice);
    continue;
  }

  if (MOCK_MODE) {
    // Log + save as DRAFT (no AutoCount call)
    const invoice: InvoiceHistory = {
      id: `inv-${Date.now()}`,
      customerId,
      customerName: customer.name,
      billingMonth,
      totalAmount: groupItems.reduce((s, li) => s + li.totalCharge, 0),
      status: "DRAFT",
      createdAt: new Date().toISOString(),
      billingMode: customer.billingMode,
      schedule: customer.schedule,
      generatedBy: "MANUAL",
      lineItems: groupItems,
      serviceId,
      projectName,
    };
    await insertInvoice(invoice);
    invoices.push(invoice);
  } else {
    // Real AutoCount sync
    const accountBook = await findAccountBookById(customer.autocountAccountBookId);
    const syncResult = await createInvoice(
      { accountBookId: accountBook.accountBookId, keyId: accountBook.keyId, apiKey: accountBook.apiKey },
      buildResult.payload
    );
    if (syncResult.success && syncResult.docNo) {
      const invoice: InvoiceHistory = {
        id: `inv-${Date.now()}`,
        customerId,
        customerName: customer.name,
        billingMonth,
        totalAmount: groupItems.reduce((s, li) => s + li.totalCharge, 0),
        status: "SYNCED",
        autocountRefId: syncResult.docNo,
        createdAt: new Date().toISOString(),
        billingMode: customer.billingMode,
        schedule: customer.schedule,
        generatedBy: "MANUAL",
        lineItems: groupItems,
        serviceId,
        projectName,
      };
      await insertInvoice(invoice);
      invoices.push(invoice);
    } else {
      const invoice: InvoiceHistory = {
        id: `inv-${Date.now()}`,
        customerId,
        customerName: customer.name,
        billingMonth,
        totalAmount: groupItems.reduce((s, li) => s + li.totalCharge, 0),
        status: "ERROR",
        syncError: syncResult.error,
        createdAt: new Date().toISOString(),
        billingMode: customer.billingMode,
        schedule: customer.schedule,
        generatedBy: "MANUAL",
        lineItems: groupItems,
        serviceId,
        projectName,
      };
      await insertInvoice(invoice);
    }
  }
}

return NextResponse.json({ invoices, billingMonth, customerId });
```

---

## Verification

After all tasks complete:

1. **Type check:** `cd billing-app && npx tsc --noEmit` — no new errors
2. **Dev server:** Start `npm run dev`, generate Zurich February 2026 invoice
3. **Check:** Three invoices generated for Zurich (ZURICH-001, ZURICH-002, ZURICH-003), each with correct:
   - `master.description`: `"Zurich Malaysia — ZURICH-001 — Policy Inquiry Bot — February 2026"`
   - Platform Fee description: `"WhatsApp Business API Monthly Platform Fee - Policy Inquiry Bot - 2026-02"`
   - `serviceId`/`projectName` stored on MongoDB documents
4. **Non-INGLAB:** Coway billing still generates single invoice (no regression)
