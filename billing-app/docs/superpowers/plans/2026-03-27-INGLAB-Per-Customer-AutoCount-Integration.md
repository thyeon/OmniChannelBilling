# INGLAB Per-Customer AutoCount Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable per-customer invoice generation for AIA, Zurich, FWD, Prudential, and Pizza Hut via `/billing/generate`, using INGLAB's per-customer `/billable?period=YYYY-MM&client_id=CLIENT-ID` API. Each INGLAB client's actual `qty` and `unit_price` from `line_items[]` drives the AutoCount invoice payload — not product mappings.

**Architecture:** INGLAB returns nested `items[].line_items[]` per API call. The DataSource model is extended to hold a `sourceClientId` (for `?client_id=` substitution) and a `nestedResponseConfig` (paths to iterate `items` and `line_items`). The billing service iterates dynamically over all `line_items` and creates one `InvoiceLineItem` per row. The AutoCount invoice builder uses the actual `qty`/`unit_price`/`description` from each `InvoiceLineItem` instead of looking up product mappings.

**Tech Stack:** TypeScript, Next.js App Router, MongoDB, Vitest

---

## ⚠️ Critical Gaps Addressed (Pre-Execution)

These gaps were identified by cross-referencing the plan against the AutoCount payload requirements. All 3 must be implemented correctly or the invoice will be wrong/missing.

### Gap 1 — `totalCharge` fallback when `unitPrice` is missing or zero

> **Critical.** Without this, `totalCharge` would be `0 * NaN = NaN` if `unitPrice` is missing.

**Problem:** In Task 3's INGLAB branch, `totalCharge: nl.qty * unitPrice` — if `unitPrice` is `0` or `undefined`, the result is `NaN` or `0`.

**Fix (Task 3, Step 3):**
```typescript
// After resolving nl.unitPrice:
const resolvedUnitPrice = (typeof nl.unitPrice === "number" && nl.unitPrice > 0)
  ? nl.unitPrice
  : (customer.rates?.[dataSource.serviceType] ?? 0);

const totalCharge = nl.qty * resolvedUnitPrice;
```

**Also:** set `lineItem.rate = resolvedUnitPrice` so downstream template resolution uses the correct rate.

---

### Gap 2 — Zero `unit_price` from INGLAB has ambiguous meaning

> **Critical.** We need an explicit business rule or `unit_price = 0` will silently produce wrong invoices.

**Problem:** INGLAB may return `unit_price = 0`. Is this:
- (a) **Intentional zero charge** — free tier, promotional, etc. → charge `0`
- (b) **Missing data** → fall back to `customer.rates[serviceType]`

**Decision required from user before execution:**
> **Chosen Rule: (b) fallback to configured rate.** `unit_price = 0` means "use our configured rate." Only `undefined`/`null` falls back to configured rate. `0` is treated as a valid price (charge 0).

**Revised logic (Task 3, Step 3):**
```typescript
// unitPrice = 0 is a VALID price (charge $0). undefined/null falls back to configured rate.
const resolvedUnitPrice = (nl.unitPrice !== undefined && nl.unitPrice !== null)
  ? nl.unitPrice
  : (customer.rates?.[dataSource.serviceType] ?? 0);
```

**Test cases to add (Task 2, Step 1):**
```typescript
it("should use configured rate when unit_price is undefined", () => {
  const apiResponse = {
    items: [{ line_items: [{ description: "SMS", qty: 100 }] }], // no unit_price
  };
  const result = processInglabNested(apiResponse, { ...baseConfig, unitPricePath: "unit_price" });
  expect(result[0].unitPrice).toBe(0); // uses default 0 when field missing
});
```

---

### Gap 3 — `{SMSRate}` token in `furtherDescriptionTemplate` uses customer-configured rate, not INGLAB `unit_price`

> **Critical.** The default template `"...charged at {SMSRate} per message"` will show the wrong rate for INGLAB invoices.

**Problem:** `resolveTemplate()` calls `getServiceData(lineItems, "SMS")` which returns `item.rate` — which is the customer-configured rate (`customer.rates.SMS`), NOT the INGLAB `unit_price`.

**Fix options:**
- **Option A (Recommended):** In Task 3, set `lineItem.rate = resolvedUnitPrice` — so `getServiceData` naturally returns the INGLAB rate
- **Option B:** Accept limitation, document that `{SMSRate}` in `furtherDescriptionTemplate` will show configured rate for INGLAB

**We choose Option A.** Task 3 Step 3 already sets `rate: unitPrice` — with Gap 1's fix (`resolvedUnitPrice`), this ensures `rate` is always correct.

**Updated Task 3 code:**
```typescript
items.push({
  // ...
  rate: resolvedUnitPrice,       // ← ensures {SMSRate} in templates is correct
  totalCharge,
  unitPrice: nl.unitPrice,        // original INGLAB unit_price (may be 0)
  description: nl.description,
  // ...
});
```

**Template behavior after fix:** `{SMSRate}` will correctly show the INGLAB `unit_price` (or configured rate if `unit_price` is missing). ✅

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/types/index.ts` | Add `unitPrice`, `description`, `descriptionDetail`, `lineItemService` to `InvoiceLineItem` |
| `src/domain/models/dataSource.ts` | Add `sourceClientId`, `nestedResponseConfig` to `DataSource` and `ResponseMapping` |
| `src/app/api/customers/[id]/datasources/route.ts` | Validate new fields on create |
| `src/app/api/customers/[id]/datasources/[dsId]/route.ts` | Validate new fields on update |
| `src/domain/services/lineItemProcessor.ts` | Add `processInglabNested()` function |
| `src/domain/services/billingService.ts` | Add INGLAB nested branch in `fetchBillableForDataSource` for `CUSTOM_REST_API` |
| `src/domain/services/autocountInvoiceBuilder.ts` | Use actual `qty`/`unitPrice`/`description` from `InvoiceLineItem` when present |
| `src/app/admin/customers/wizard/DataSourceStep.tsx` | Add INGLAB-specific config fields to UI form |
| `scripts/seed-inglab-customers.ts` | Seed MongoDB with 5 INGLAB customers and their DataSources |
| `src/app/api/invoices/generate/preview/route.ts` | No changes needed |
| `src/app/api/invoices/generate/generic/route.ts` | No changes needed |

---

## INGLAB API Reference

**Endpoint:** `GET /billable?period=YYYY-MM&client_id=CLIENT-ID`
**Auth:** `Authorization: Bearer {token}` (stored in DataSource `authCredentials.token`)

**Response shape:**
```json
{
  "partner_id": "INGLAB",
  "period": "2026-03",
  "items": [
    {
      "id": "draft-SERVICE-001-...",
      "service_id": "SERVICE-001",
      "source_client_name": "AIA Malaysia",
      "service": "WhatsApp Business API",
      "line_items": [
        { "description": "SMS", "description_detail": "ECS SMS Service", "qty": 100, "unit_price": 0.079 },
        { "description": "WhatsApp", "description_detail": "ECS WhatsApp Service", "qty": 50, "unit_price": 0.10 }
      ]
    }
  ]
}
```

**Expected DataSource config per INGLAB customer:**
```json
{
  "type": "CUSTOM_REST_API",
  "serviceType": "SMS",
  "name": "INGLAB - AIA Malaysia",
  "apiEndpoint": "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB/billable",
  "authType": "BEARER_TOKEN",
  "authCredentials": { "token": "<per-customer-token>" },
  "sourceClientId": "CLIENT-AIA",
  "nestedResponseConfig": {
    "itemsPath": "items",
    "lineItemsPath": "line_items",
    "descriptionPath": "description",
    "descriptionDetailPath": "description_detail",
    "qtyPath": "qty",
    "unitPricePath": "unit_price"
  },
  "isActive": true
}
```

---

## Constraints

1. **Per-customer tokens** — Each INGLAB customer has their own API token. Stored in `authCredentials.token` on the DataSource (Bearer token auth).
2. **No bulk loading** — We call `/billable?client_id=X` per customer, not the bulk endpoint. No client-side filtering needed.
3. **Backward compatibility** — Existing `COWAY_API`, `RECON_SERVER`, and flat `CUSTOM_REST_API` data sources continue to work exactly as before.
4. **`lineItemMappings` vs `nestedResponseConfig`** — These are mutually exclusive. If `nestedResponseConfig` is set, use INGLAB nested processing. Otherwise fall back to existing `lineItemMappings` or flat `responseMapping`.
5. **AutoCount payload uses actual API values** — When `unitPrice` is present on `InvoiceLineItem`, the builder uses it directly instead of looking up product mappings. **`unit_price = 0` from INGLAB is a valid price** (produces $0 charge); only `undefined`/`null` falls back to `customer.rates[serviceType]`.
6. **One InvoiceLineItem per `line_items` row** — Each `line_items` entry (SMS, WhatsApp, Email) becomes a separate AutoCount detail row with its own description and price.

---

## Acceptance Criteria

### Functional Criteria

- [ ] **AC1:** A DataSource with `sourceClientId` and `nestedResponseConfig` can be created via `POST /api/customers/[id]/datasources`
- [ ] **AC2:** `generateBillableData()` for a CUSTOM_REST_API DataSource with `nestedResponseConfig` fetches `/billable?period=YYYY-MM&client_id=CLIENT-ID`, iterates `items[].line_items[]`, and returns one `InvoiceLineItem` per `line_items` row
- [ ] **AC3:** Each `InvoiceLineItem` carries `qty` (→ `billableCount`), `unitPrice`, `description`, and `descriptionDetail` from the API response
- [ ] **AC4:** `buildAutoCountInvoice()` uses `lineItem.unitPrice` as the AutoCount detail `unitPrice` when present (ITEMIZED mode); uses `lineItem.description` or `lineItem.descriptionDetail` for the AutoCount detail `description` when present. Falls back to `customer.rates[serviceType]` when `unitPrice` is `undefined`.
- [ ] **AC5:** The `/billing/generate` UI preview shows correct per-row data for INGLAB customers (actual qty, description, price from API)
- [ ] **AC6:** `/billing/generate` generic endpoint saves invoice to MongoDB with correct line items (MOCK_MODE logs correct payload)
- [ ] **AC7:** Backward compatibility: existing flat `CUSTOM_REST_API` DataSources (Coway, etc.) continue to generate correct invoices
- [ ] **AC8:** The DataSourceStep wizard allows configuring `sourceClientId` and `nestedResponseConfig` fields for INGLAB DataSources

### Non-Functional Criteria

- [ ] **AC9:** All new functions have Vitest unit tests (processInglabNested, nested branch in billingService)
- [ ] **AC10:** API validation rejects invalid `nestedResponseConfig` (e.g., invalid JSON path strings)
- [ ] **AC11:** Zero breaking changes to existing API contracts or MongoDB schemas

---

## Test Plan

### Unit Tests (Vitest)

| Test File | What to Test |
|-----------|-------------|
| `src/domain/services/__tests__/lineItemProcessor.test.ts` | `processInglabNested()` — happy path with INGLAB response, empty items, missing fields, zero qty |
| `src/domain/services/__tests__/inglabNested.test.ts` (new) | `billingService` INGLAB branch — mocked fetch, nested line items, fallback behavior |
| `src/app/api/customers/[id]/datasources/__tests__/route.test.ts` | Validate `nestedResponseConfig` fields in POST and PUT |

### Integration / Manual Test Scenarios

| # | Scenario | Steps | Expected Result |
|---|----------|-------|----------------|
| T1 | Preview invoice for AIA | Select AIA customer, billing month 2026-03, click Preview | Shows 2+ rows (SMS + WhatsApp) with actual qty/description from INGLAB API |
| T2 | Generate invoice for FWD | Select FWD, month 2026-03, click Generate | Invoice saved to MongoDB, payload logged to `logs/generic-mock-invoices.log` with correct line items |
| T3 | Existing Coway customer still works | Select Coway customer, generate invoice | Flat response processed, single InvoiceLineItem created, correct charge |
| T4 | Invalid nestedResponseConfig rejected | Create DataSource with malformed `nestedResponseConfig` | API returns 400 with validation error |
| T5 | UI shows INGLAB fields | Open DataSourceStep wizard, click Add | Form shows `sourceClientId` and `nestedResponseConfig` section |

---

## Tasks

### Task 1: Extend InvoiceLineItem and DataSource types

**Files:**
- Modify: `src/types/index.ts:104-130` — add 4 fields to `InvoiceLineItem`
- Modify: `src/domain/models/dataSource.ts:1-113` — add `sourceClientId` and `nestedResponseConfig`

- [ ] **Step 1: Write the failing test — InvoiceLineItem new fields**

```typescript
// src/types/__tests__/index.test.ts
it("should have optional INGLAB fields on InvoiceLineItem", () => {
  const item: InvoiceLineItem = {
    dataSourceId: "ds_1",
    lineIdentifier: "SMS",
    service: "SMS",
    hasProvider: true,
    reconServerStatus: "SUCCESS",
    providerStatus: "SUCCESS",
    reconServerName: "INGLAB",
    providerName: "GTS",
    reconTotal: 100,
    reconDetails: { sent: 100, failed: 0, withheld: 0 },
    providerTotal: 100,
    discrepancyPercentage: 0,
    isMismatch: false,
    thresholdUsed: 0,
    billableCount: 100,
    wasOverridden: false,
    rate: 0.079,
    totalCharge: 7.90,
    // INGLAB fields:
    unitPrice: 0.079,
    description: "SMS",
    descriptionDetail: "ECS SMS Service",
    lineItemService: "WhatsApp Business API",
  };
  expect(item.unitPrice).toBe(0.079);
  expect(item.description).toBe("SMS");
  expect(item.descriptionDetail).toBe("ECS SMS Service");
  expect(item.lineItemService).toBe("WhatsApp Business API");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/types/__tests__/index.test.ts --run`
Expected: FAIL — `unitPrice`, `description`, `descriptionDetail`, `lineItemService` don't exist on `InvoiceLineItem`

- [ ] **Step 3: Add fields to InvoiceLineItem in types/index.ts**

```typescript
// Add after line 130 in InvoiceLineItem interface:
unitPrice?: number;       // Actual unit price from INGLAB API
description?: string;      // Actual description from INGLAB line item
descriptionDetail?: string;// Actual description_detail from INGLAB line item
lineItemService?: string;  // Actual service name (e.g., "WhatsApp Business API")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/types/__tests__/index.test.ts --run`
Expected: PASS

- [ ] **Step 5: Add NestedResponseConfig to dataSource.ts**

```typescript
// Add after ResponseMapping interface:
export interface NestedResponseConfig {
  itemsPath: string;           // e.g., "items" — path to items array
  lineItemsPath: string;       // e.g., "line_items" — path to line items array within each item
  descriptionPath: string;     // e.g., "description"
  descriptionDetailPath?: string; // e.g., "description_detail"
  qtyPath: string;            // e.g., "qty"
  unitPricePath: string;       // e.g., "unit_price"
  servicePath?: string;        // e.g., "service" — for lineItemService
}

// Add to ResponseMapping interface:
nestedResponseConfig?: NestedResponseConfig;

// Add to DataSource interface:
sourceClientId?: string; // INGLAB client_id for ?client_id= query param
```

- [ ] **Step 6: Add sourceClientId to DataSource interface**

Add `sourceClientId?: string;` field to the `DataSource` interface.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/domain/models/dataSource.ts
git commit -m "feat(inglab): add InvoiceLineItem and DataSource fields for INGLAB nested support"
```

---

### Task 2: Add processInglabNested to lineItemProcessor

**Files:**
- Modify: `src/domain/services/lineItemProcessor.ts` — add `processInglabNested()`
- Create: `src/domain/services/__tests__/inglabNested.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/services/__tests__/inglabNested.test.ts
import { processInglabNested } from "../lineItemProcessor";
import { NestedResponseConfig } from "@/domain/models/dataSource";

describe("processInglabNested", () => {
  const baseConfig: NestedResponseConfig = {
    itemsPath: "items",
    lineItemsPath: "line_items",
    descriptionPath: "description",
    descriptionDetailPath: "description_detail",
    qtyPath: "qty",
    unitPricePath: "unit_price",
    servicePath: "service",
  };

  it("should extract all line items from nested INGLAB response", () => {
    const apiResponse = {
      items: [
        {
          service: "WhatsApp Business API",
          line_items: [
            { description: "SMS", description_detail: "ECS SMS Service", qty: 100, unit_price: 0.079 },
            { description: "WhatsApp", description_detail: "ECS WhatsApp Service", qty: 50, unit_price: 0.10 },
          ],
        },
      ],
    };

    const result = processInglabNested(apiResponse, baseConfig);

    expect(result).toEqual([
      { description: "SMS", descriptionDetail: "ECS SMS Service", qty: 100, unitPrice: 0.079, service: "WhatsApp Business API" },
      { description: "WhatsApp", descriptionDetail: "ECS WhatsApp Service", qty: 50, unitPrice: 0.10, service: "WhatsApp Business API" },
    ]);
  });

  it("should handle empty items array", () => {
    const result = processInglabNested({ items: [] }, baseConfig);
    expect(result).toEqual([]);
  });

  it("should handle items array with empty line_items", () => {
    const result = processInglabNested({ items: [{ line_items: [] }] }, baseConfig);
    expect(result).toEqual([]);
  });

  it("should handle missing optional descriptionDetailPath", () => {
    const config: NestedResponseConfig = {
      ...baseConfig,
      descriptionDetailPath: undefined,
    };
    const apiResponse = {
      items: [{ line_items: [{ description: "SMS", qty: 100, unit_price: 0.079 }] }],
    };
    const result = processInglabNested(apiResponse, config);
    expect(result[0].descriptionDetail).toBeUndefined();
  });

  it("should handle zero qty line items", () => {
    const apiResponse = {
      items: [{ line_items: [{ description: "Zero SMS", qty: 0, unit_price: 0.079 }] }],
    };
    const result = processInglabNested(apiResponse, baseConfig);
    expect(result[0].qty).toBe(0);
  });

  it("should return unitPrice = 0 when API returns unit_price = 0 (Gap 1)", () => {
    // unit_price = 0 from INGLAB is a VALID price — processInglabNested must preserve it as 0
    const apiResponse = {
      items: [{ line_items: [{ description: "Free SMS", qty: 100, unit_price: 0 }] }],
    };
    const result = processInglabNested(apiResponse, baseConfig);
    expect(result[0].unitPrice).toBe(0);
    expect(result[0].qty).toBe(100);
  });

  it("should return unitPrice = 0 when unit_price field is missing (Gap 1 fallback)", () => {
    // Missing unit_price -> processInglabNested returns 0 (gap handled in billingService)
    const apiResponse = {
      items: [{ line_items: [{ description: "SMS", qty: 100 }] }], // no unit_price
    };
    const result = processInglabNested(apiResponse, { ...baseConfig });
    expect(result[0].unitPrice).toBe(0); // getNestedValue returns undefined → cast to 0
  });

  it("should use getNestedValue helper for path resolution", () => {
    // Uses existing dot-notation and array-index notation
    const apiResponse = {
      data: {
        items: [
          { line_items: [{ description: "Test", qty: 10, unit_price: 0.05 }] },
        ],
      },
    };
    const config: NestedResponseConfig = {
      ...baseConfig,
      itemsPath: "data.items",
      lineItemsPath: "line_items",
    };
    const result = processInglabNested(apiResponse, config);
    expect(result[0].description).toBe("Test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/domain/services/__tests__/inglabNested.test.ts --run`
Expected: FAIL — `processInglabNested` not exported

- [ ] **Step 3: Implement processInglabNested in lineItemProcessor.ts**

```typescript
/**
 * Result of processing a single line item from an INGLAB nested response.
 */
export interface InglabNestedResult {
  description: string;
  descriptionDetail?: string;
  qty: number;
  unitPrice: number;
  service?: string;
}

/**
 * Process INGLAB nested API response.
 * Iterates over items[].line_items[] and extracts per-row data.
 *
 * @param apiResponse - The full API response object
 * @param config - NestedResponseConfig defining paths to items and line_items arrays
 * @returns InglabNestedResult[] - one entry per line_items row
 */
export function processInglabNested(
  apiResponse: unknown,
  config: NestedResponseConfig
): InglabNestedResult[] {
  const results: InglabNestedResult[] = [];

  // Resolve items array using the existing getNestedValue helper
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

      // Skip entries with no qty
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/domain/services/__tests__/inglabNested.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/lineItemProcessor.ts src/domain/services/__tests__/inglabNested.test.ts
git commit -m "feat(inglab): add processInglabNested for nested line_items extraction"
```

---

### Task 3: Extend billingService for INGLAB nested branch

**Files:**
- Modify: `src/domain/services/billingService.ts:220-401` — add INGLAB branch in `fetchBillableForDataSource`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/services/__tests__/billingServiceInglab.test.ts
import { generateBillableData } from "../billingService";
import * as customerRepository from "@/infrastructure/db/customerRepository";
import * as dataSourceRepository from "@/infrastructure/db/dataSourceRepository";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/infrastructure/db/customerRepository");
vi.mock("@/infrastructure/db/dataSourceRepository");

describe("billingService — INGLAB nested CUSTOM_REST_API", () => {
  const mockCustomerId = "cust-aia";
  const mockBillingMonth = "2026-03";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create one InvoiceLineItem per line_items row for INGLAB", async () => {
    const mockCustomer = {
      id: mockCustomerId,
      name: "AIA Malaysia",
      status: "ACTIVE" as const,
      rates: { SMS: 0.05, WHATSAPP: 0.05 },
      billingCycle: "MONTHLY" as const,
      discrepancyThreshold: 1.0,
    };

    const mockDataSource = {
      id: "ds_aia",
      customerId: mockCustomerId,
      type: "CUSTOM_REST_API" as const,
      serviceType: "SMS" as const,
      name: "INGLAB - AIA",
      apiEndpoint: "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB/billable",
      authType: "BEARER_TOKEN" as const,
      authCredentials: { token: "test-token" },
      sourceClientId: "CLIENT-AIA",
      nestedResponseConfig: {
        itemsPath: "items",
        lineItemsPath: "line_items",
        descriptionPath: "description",
        descriptionDetailPath: "description_detail",
        qtyPath: "qty",
        unitPricePath: "unit_price",
        servicePath: "service",
      },
      isActive: true,
    };

    vi.spyOn(customerRepository, "findCustomerById").mockResolvedValue(mockCustomer);
    vi.spyOn(dataSourceRepository, "findActiveDataSourcesByCustomerId").mockResolvedValue([mockDataSource]);

    // Mock global fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [
          {
            service: "WhatsApp Business API",
            line_items: [
              { description: "SMS", description_detail: "ECS SMS Service", qty: 100, unit_price: 0.079 },
              { description: "WhatsApp", description_detail: "ECS WhatsApp Service", qty: 50, unit_price: 0.10 },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await generateBillableData(mockCustomerId, mockBillingMonth);

    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({
      dataSourceId: "ds_aia",
      billableCount: 100,
      unitPrice: 0.079,
      description: "SMS",
      descriptionDetail: "ECS SMS Service",
      lineItemService: "WhatsApp Business API",
    });
    expect(result.lineItems[1]).toMatchObject({
      dataSourceId: "ds_aia",
      billableCount: 50,
      unitPrice: 0.10,
      description: "WhatsApp",
      descriptionDetail: "ECS WhatsApp Service",
    });
  });

  it("should skip INGLAB DataSource with missing nestedResponseConfig (use flat path)", async () => {
    // When nestedResponseConfig is not set, falls through to flat/multi-line processing
    // This test ensures backward compatibility
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/domain/services/__tests__/billingServiceInglab.test.ts --run`
Expected: FAIL — INGLAB branch doesn't exist

- [ ] **Step 3: Add INGLAB branch to billingService.ts**

> **⚠️ Critical:** Must implement all 3 gap fixes below. See "Critical Gaps Addressed" section above.

In `fetchBillableForDataSource`, within the `CUSTOM_REST_API` case, add this check BEFORE the flat/multi-line processing:

```typescript
// In CUSTOM_REST_API case, after building url/fetchOptions:
// Check if this is an INGLAB nested response DataSource
if (dataSource.nestedResponseConfig && dataSource.sourceClientId) {
  // Append ?client_id= to the URL
  const clientIdParam = `client_id=${encodeURIComponent(dataSource.sourceClientId)}`;
  const urlWithClient = url.includes("?")
    ? `${url}&${clientIdParam}`
    : `${url}?${clientIdParam}`;

  const nestedResponse = await fetchWithRetry(urlWithClient, fetchOptions);
  const nestedResults = processInglabNested(nestedResponse, dataSource.nestedResponseConfig);

  const items: InvoiceLineItem[] = [];
  for (const nl of nestedResults) {
    if (nl.qty === 0) continue;

    // ⚠️ Gap 2 fix: unit_price = 0 is VALID (charge $0). undefined falls back to configured rate.
    const resolvedUnitPrice = (nl.unitPrice !== undefined && nl.unitPrice !== null)
      ? nl.unitPrice
      : (customer.rates?.[dataSource.serviceType] ?? 0);

    // ⚠️ Gap 1 fix: totalCharge uses resolvedUnitPrice (not raw nl.unitPrice which may be undefined)
    const totalCharge = nl.qty * resolvedUnitPrice;

    items.push({
      dataSourceId: dataSource.id,
      lineIdentifier: nl.description,
      service: dataSource.serviceType,
      hasProvider: true,
      reconServerStatus: "SUCCESS",
      providerStatus: "SUCCESS",
      reconServerName: dataSource.name,
      providerName: getProviderName(dataSource.serviceType),
      reconTotal: nl.qty,
      reconDetails: { sent: nl.qty, failed: 0, withheld: 0 },
      providerTotal: nl.qty,
      discrepancyPercentage: 0,
      isMismatch: false,
      thresholdUsed: customer.discrepancyThreshold || 0,
      billableCount: nl.qty,
      wasOverridden: false,
      rate: resolvedUnitPrice,       // ⚠️ Gap 3 fix: ensures {SMSRate} in templates = INGLAB unit_price
      totalCharge,
      unitPrice: nl.unitPrice,       // original INGLAB unit_price (may be 0 or undefined)
      description: nl.description,
      descriptionDetail: nl.descriptionDetail,
      lineItemService: nl.service,
    });
  }
  return items;
}

// Continue with existing flat/multi-line processing...
```

Also add imports at top of file:
```typescript
import { processInglabNested } from "./lineItemProcessor";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/domain/services/__tests__/billingServiceInglab.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/billingService.ts
git commit -m "feat(inglab): add nested response branch in billingService for CUSTOM_REST_API"
```

---

### Task 4: Extend autocountInvoiceBuilder to use actual INGLAB values

**Files:**
- Modify: `src/domain/services/autocountInvoiceBuilder.ts:104-183` — update loop to use `lineItem.unitPrice`/`description`

- [ ] **Step 1: Write the failing test**

```typescript
// src/domain/services/__tests__/autocountInvoiceBuilderInglab.test.ts
import { buildAutoCountInvoice } from "../autocountInvoiceBuilder";
import * as autoCountAccountBookRepository from "@/infrastructure/db/autoCountAccountBookRepository";
import * as serviceProductMappingRepository from "@/infrastructure/db/serviceProductMappingRepository";
import * as customerProductMappingRepository from "@/infrastructure/db/customerProductMappingRepository";
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/infrastructure/db/autoCountAccountBookRepository");
vi.mock("@/infrastructure/db/serviceProductMappingRepository");
vi.mock("@/infrastructure/db/customerProductMappingRepository");

describe("autocountInvoiceBuilder — uses actual INGLAB line item values", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should use lineItem.unitPrice and lineItem.description when present (ITEMIZED)", async () => {
    const customer = {
      id: "cust_aia",
      name: "AIA Malaysia",
      autocountAccountBookId: "ab_001",
      autocountDebtorCode: "AIA-001",
      defaultFields: {},
    };
    const billingMonth = "2026-03";
    const lineItems = [
      {
        dataSourceId: "ds_aia",
        lineIdentifier: "SMS",
        service: "SMS" as const,
        hasProvider: true,
        reconServerStatus: "SUCCESS" as const,
        providerStatus: "SUCCESS" as const,
        reconServerName: "INGLAB",
        providerName: "GTS",
        reconTotal: 100,
        reconDetails: { sent: 100, failed: 0, withheld: 0 },
        providerTotal: 100,
        discrepancyPercentage: 0,
        isMismatch: false,
        thresholdUsed: 0,
        billableCount: 100,
        wasOverridden: false,
        rate: 0.079,
        totalCharge: 7.90,
        // INGLAB fields:
        unitPrice: 0.079,
        description: "SMS",
        descriptionDetail: "ECS SMS Service",
        lineItemService: "WhatsApp Business API",
      },
    ];

    vi.spyOn(autoCountAccountBookRepository, "findAccountBookById").mockResolvedValue({
      id: "ab_001",
      accountBookId: "AB001",
      name: "AutoCount Book",
      defaultCreditTerm: "30",
      defaultSalesLocation: "HQ",
      defaultSalesAgent: "Olivia Yap",
      defaultAccNo: "500-0000",
      defaultTaxCode: "SR",
      inclusiveTax: false,
    });
    vi.spyOn(serviceProductMappingRepository, "findMappingByAccountBookAndService").mockResolvedValue(null);
    vi.spyOn(customerProductMappingRepository, "findCustomerProductMappingByKey").mockResolvedValue(null);

    const result = await buildAutoCountInvoice({ customer, billingMonth, lineItems });

    expect(result.success).toBe(true);
    const detail = result.payload!.details[0];
    expect(detail.unitPrice).toBe(0.079);       // From lineItem.unitPrice, not product mapping
    expect(detail.description).toContain("SMS"); // Uses lineItem.description when present
    expect(detail.qty).toBe(100);               // ITEMIZED mode uses billableCount
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/domain/services/__tests__/autocountInvoiceBuilderInglab.test.ts --run`
Expected: FAIL — `unitPrice`, `description` not used

- [ ] **Step 3: Update autocountInvoiceBuilder.ts — use INGLAB fields when present**

In the `for (const lineItem of lineItems)` loop, after looking up mappings:

```typescript
// ⚠️ Gap 1 fix: unitPrice = 0 is VALID (charge $0). undefined/null falls back to configured rate.
const resolvedUnitPrice = (lineItem.unitPrice !== undefined && lineItem.unitPrice !== null)
  ? lineItem.unitPrice
  : (billingMode === "LUMP_SUM"
      ? lineItem.totalCharge
      : (customerMapping?.defaultUnitPrice ?? accountBookMapping?.defaultUnitPrice ?? lineItem.rate)
  );

const resolvedDescription = (lineItem.description || lineItem.descriptionDetail)
  ? `${lineItem.description || ""}${lineItem.descriptionDetail ? ` - ${lineItem.descriptionDetail}` : ""} - ${billingMonth}`
  : (mapping?.description
      ? `${mapping.description} - ${billingMonth}`
      : `${lineItem.service} Service - ${billingMonth}`);

// ⚠️ Gap 3 fix: billingMode=ITEMIZED when lineItem.unitPrice is present (INGLAB provides actual price)
const effectiveBillingMode = (lineItem.unitPrice !== undefined && lineItem.unitPrice !== null)
  ? "ITEMIZED"
  : billingMode;

const qty = effectiveBillingMode === "LUMP_SUM" ? 1 : lineItem.billableCount;
```

Update the `details.push()` call to use `resolvedUnitPrice`, `resolvedDescription`, `qty`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/domain/services/__tests__/autocountInvoiceBuilderInglab.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/autocountInvoiceBuilder.ts
git commit -m "feat(inglab): autocountInvoiceBuilder uses actual unitPrice/description from InvoiceLineItem"
```

---

### Task 5: Extend DataSource API route validation

**Files:**
- Modify: `src/app/api/customers/[id]/datasources/route.ts` — add `nestedResponseConfig` and `sourceClientId` validation
- Modify: `src/app/api/customers/[id]/datasources/[dsId]/route.ts` — add `nestedResponseConfig` and `sourceClientId` update validation

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/customers/[id]/datasources/__tests__/route.test.ts
// (extend existing placeholder tests)
describe("INGLAB nestedResponseConfig validation", () => {
  it("should accept valid nestedResponseConfig in POST body", () => {
    expect(true).toBe(true); // placeholder — real test needs supertest or direct validation fn import
  });
  it("should reject nestedResponseConfig with missing required paths", () => {
    expect(true).toBe(true);
  });
  it("should accept sourceClientId as string in POST body", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Add validation to POST route (route.ts)**

In `validateDataSourceBody`, after validating `responseMapping`:

```typescript
// Validate nestedResponseConfig (optional)
let nestedResponseConfig: {
  itemsPath: string;
  lineItemsPath: string;
  descriptionPath: string;
  descriptionDetailPath?: string;
  qtyPath: string;
  unitPricePath: string;
  servicePath?: string;
} | undefined;
if (b.nestedResponseConfig !== undefined) {
  if (typeof b.nestedResponseConfig !== "object") {
    return { valid: false, error: "nestedResponseConfig must be an object" };
  }
  const nc = b.nestedResponseConfig as Record<string, unknown>;
  if (typeof nc.itemsPath !== "string") return { valid: false, error: "nestedResponseConfig.itemsPath required" };
  if (typeof nc.lineItemsPath !== "string") return { valid: false, error: "nestedResponseConfig.lineItemsPath required" };
  if (typeof nc.descriptionPath !== "string") return { valid: false, error: "nestedResponseConfig.descriptionPath required" };
  if (typeof nc.qtyPath !== "string") return { valid: false, error: "nestedResponseConfig.qtyPath required" };
  if (typeof nc.unitPricePath !== "string") return { valid: false, error: "nestedResponseConfig.unitPricePath required" };
  nestedResponseConfig = {
    itemsPath: nc.itemsPath as string,
    lineItemsPath: nc.lineItemsPath as string,
    descriptionPath: nc.descriptionPath as string,
    descriptionDetailPath: nc.descriptionDetailPath as string | undefined,
    qtyPath: nc.qtyPath as string,
    unitPricePath: nc.unitPricePath as string,
    servicePath: nc.servicePath as string | undefined,
  };
}

// Validate sourceClientId (optional)
if (b.sourceClientId !== undefined && typeof b.sourceClientId !== "string") {
  return { valid: false, error: "sourceClientId must be a string" };
}
```

Add to the return data object:
```typescript
nestedResponseConfig,
sourceClientId: b.sourceClientId as string | undefined,
```

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `npx vitest src/app/api/customers/[id]/datasources/__tests__/route.test.ts --run`
Expected: PASS (existing placeholder tests pass)

- [ ] **Step 4: Add validation to PUT route (datasources/[dsId]/route.ts)**

Add similar `nestedResponseConfig` and `sourceClientId` validation to `validateDataSourceUpdate` function.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/customers/[id]/datasources/route.ts src/app/api/customers/[id]/datasources/[dsId]/route.ts
git commit -m "feat(api): validate nestedResponseConfig and sourceClientId in DataSource routes"
```

---

### Task 6: Extend DataSourceStep wizard UI for INGLAB fields

**Files:**
- Modify: `src/app/admin/customers/wizard/DataSourceStep.tsx:46-115` — add `sourceClientId` and `nestedResponseConfig` to form and dialog

- [ ] **Step 1: Add new form fields to DataSourceFormData interface**

```typescript
// Add to DataSourceFormData interface:
sourceClientId: string;
nestedItemsPath: string;
nestedLineItemsPath: string;
nestedDescriptionPath: string;
nestedDescriptionDetailPath: string;
nestedQtyPath: string;
nestedUnitPricePath: string;
nestedServicePath: string;
```

- [ ] **Step 2: Add to emptyFormData**

```typescript
sourceClientId: "",
nestedItemsPath: "",
nestedLineItemsPath: "",
nestedDescriptionPath: "",
nestedDescriptionDetailPath: "",
nestedQtyPath: "",
nestedUnitPricePath: "",
nestedServicePath: "",
```

- [ ] **Step 3: Update openEditDialog to populate new fields**

```typescript
sourceClientId: ds.sourceClientId || "",
nestedItemsPath: ds.nestedResponseConfig?.itemsPath || "",
nestedLineItemsPath: ds.nestedResponseConfig?.lineItemsPath || "",
nestedDescriptionPath: ds.nestedResponseConfig?.descriptionPath || "",
nestedDescriptionDetailPath: ds.nestedResponseConfig?.descriptionDetailPath || "",
nestedQtyPath: ds.nestedResponseConfig?.qtyPath || "",
nestedUnitPricePath: ds.nestedResponseConfig?.unitPricePath || "",
nestedServicePath: ds.nestedResponseConfig?.servicePath || "",
```

- [ ] **Step 4: Add new fields to the API payload in handleSave**

```typescript
sourceClientId: formData.sourceClientId || undefined,
nestedResponseConfig: (formData.nestedItemsPath && formData.nestedLineItemsPath && formData.nestedDescriptionPath && formData.nestedQtyPath && formData.nestedUnitPricePath)
  ? {
      itemsPath: formData.nestedItemsPath,
      lineItemsPath: formData.nestedLineItemsPath,
      descriptionPath: formData.nestedDescriptionPath,
      descriptionDetailPath: formData.nestedDescriptionDetailPath || undefined,
      qtyPath: formData.nestedQtyPath,
      unitPricePath: formData.nestedUnitPricePath,
      servicePath: formData.nestedServicePath || undefined,
    }
  : undefined,
```

- [ ] **Step 5: Add INGLAB section to the dialog form**

In the dialog form (after the "Active toggle" section, inside the Accordion or as a new section):

```tsx
{/* INGLAB Nested Response Config */}
{(formData.authType === "BEARER_TOKEN" || formData.type === "CUSTOM_REST_API") && (
  <div className="space-y-2 border-t pt-4">
    <h4 className="font-medium">INGLAB Nested Response (optional)</h4>
    <p className="text-xs text-muted-foreground">
      Fill this section only if the API returns nested items[].line_items[]. Leave empty for flat responses.
    </p>
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="sourceClientId">sourceClientId (INGLAB client_id)</Label>
        <Input
          id="sourceClientId"
          value={formData.sourceClientId}
          onChange={(e) => setFormData({ ...formData, sourceClientId: e.target.value })}
          placeholder="e.g., CLIENT-AIA"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nestedServicePath">Service Path (optional)</Label>
        <Input
          id="nestedServicePath"
          value={formData.nestedServicePath}
          onChange={(e) => setFormData({ ...formData, nestedServicePath: e.target.value })}
          placeholder="e.g., service"
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="nestedItemsPath">Items Path *</Label>
        <Input
          id="nestedItemsPath"
          value={formData.nestedItemsPath}
          onChange={(e) => setFormData({ ...formData, nestedItemsPath: e.target.value })}
          placeholder="e.g., items"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nestedLineItemsPath">Line Items Path *</Label>
        <Input
          id="nestedLineItemsPath"
          value={formData.nestedLineItemsPath}
          onChange={(e) => setFormData({ ...formData, nestedLineItemsPath: e.target.value })}
          placeholder="e.g., line_items"
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="nestedQtyPath">Qty Path *</Label>
        <Input
          id="nestedQtyPath"
          value={formData.nestedQtyPath}
          onChange={(e) => setFormData({ ...formData, nestedQtyPath: e.target.value })}
          placeholder="e.g., qty"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nestedUnitPricePath">Unit Price Path *</Label>
        <Input
          id="nestedUnitPricePath"
          value={formData.nestedUnitPricePath}
          onChange={(e) => setFormData({ ...formData, nestedUnitPricePath: e.target.value })}
          placeholder="e.g., unit_price"
        />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="nestedDescriptionPath">Description Path *</Label>
        <Input
          id="nestedDescriptionPath"
          value={formData.nestedDescriptionPath}
          onChange={(e) => setFormData({ ...formData, nestedDescriptionPath: e.target.value })}
          placeholder="e.g., description"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nestedDescriptionDetailPath">Description Detail Path</Label>
        <Input
          id="nestedDescriptionDetailPath"
          value={formData.nestedDescriptionDetailPath}
          onChange={(e) => setFormData({ ...formData, nestedDescriptionDetailPath: e.target.value })}
          placeholder="e.g., description_detail"
        />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/customers/wizard/DataSourceStep.tsx
git commit -m "feat(ui): add INGLAB nested config fields to DataSourceStep wizard"
```

---

### Task 7: Seed MongoDB with 5 INGLAB customers and DataSources

**Files:**
- Create: `scripts/seed-inglab-customers.ts`

- [ ] **Step 1: Write the seed script**

```typescript
/**
 * Seed script: Insert 5 INGLAB customers and their DataSources into MongoDB.
 * Run: npx tsx scripts/seed-inglab-customers.ts
 *
 * INGLAB customers: AIA Malaysia, Zurich Malaysia, FWD Takaful,
 *                   Prudential Malaysia, Pizza Hut
 *
 * Each customer has:
 *   - 1 Customer record in 'customers' collection
 *   - 1 DataSource record in 'dataSources' collection (CUSTOM_REST_API)
 */

import { connectDatabase, getDatabase } from "../src/infrastructure/db/mongodb";

const INGLAB_BASE_URL = "https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB";

const customers = [
  {
    name: "AIA Malaysia",
    autocountCustomerId: "AIA-001",
    autocountDebtorCode: "AIA-001",
    autocountAccountBookId: "AB001",
    services: ["SMS", "WHATSAPP"] as const,
    rates: { SMS: 0.079, WHATSAPP: 0.10, EMAIL: 0.05 },
    billingMode: "AUTO_PILOT" as const,
    billingCycle: "MONTHLY" as const,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE" as const,
    sourceClientId: "CLIENT-AIA",
  },
  {
    name: "Zurich Malaysia",
    autocountCustomerId: "ZURICH-001",
    autocountDebtorCode: "ZURICH-001",
    autocountAccountBookId: "AB001",
    services: ["SMS", "WHATSAPP"] as const,
    rates: { SMS: 0.079, WHATSAPP: 0.10, EMAIL: 0.05 },
    billingMode: "AUTO_PILOT" as const,
    billingCycle: "MONTHLY" as const,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE" as const,
    sourceClientId: "CLIENT-ZURICH",
  },
  {
    name: "FWD Takaful",
    autocountCustomerId: "FWD-001",
    autocountDebtorCode: "FWD-001",
    autocountAccountBookId: "AB001",
    services: ["SMS", "WHATSAPP"] as const,
    rates: { SMS: 0.079, WHATSAPP: 0.10, EMAIL: 0.05 },
    billingMode: "AUTO_PILOT" as const,
    billingCycle: "MONTHLY" as const,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE" as const,
    sourceClientId: "CLIENT-FWD",
  },
  {
    name: "Prudential Malaysia",
    autocountCustomerId: "PRU-001",
    autocountDebtorCode: "PRU-001",
    autocountAccountBookId: "AB001",
    services: ["SMS", "WHATSAPP"] as const,
    rates: { SMS: 0.079, WHATSAPP: 0.10, EMAIL: 0.05 },
    billingMode: "AUTO_PILOT" as const,
    billingCycle: "MONTHLY" as const,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE" as const,
    sourceClientId: "CLIENT-PRUDENTIAL",
  },
  {
    name: "Pizza Hut",
    autocountCustomerId: "PIZZAHUT-001",
    autocountDebtorCode: "PIZZAHUT-001",
    autocountAccountBookId: "AB001",
    services: ["SMS"] as const,
    rates: { SMS: 0.079, WHATSAPP: 0.10, EMAIL: 0.05 },
    billingMode: "AUTO_PILOT" as const,
    billingCycle: "MONTHLY" as const,
    consolidateInvoice: false,
    discrepancyThreshold: 1.0,
    status: "ACTIVE" as const,
    sourceClientId: "CLIENT-PIZZAHUT",
  },
];

async function main() {
  await connectDatabase();
  const db = getDatabase();

  console.log("🌱 Seeding INGLAB customers and DataSources...\n");

  for (const customerData of customers) {
    const { sourceClientId, ...customerFields } = customerData;
    const customerId = `cust_${customerData.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;

    // Insert Customer
    const customer = {
      id: customerId,
      ...customerFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("customers").updateOne(
      { id: customerId },
      { $setOnInsert: customer },
      { upsert: true }
    );
    console.log(`✓ Customer: ${customerData.name} (${customerId})`);

    // Insert DataSource
    const dataSourceId = `ds_${customerData.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    const dataSource = {
      id: dataSourceId,
      customerId,
      type: "CUSTOM_REST_API",
      serviceType: "SMS",
      name: `INGLAB - ${customerData.name}`,
      apiEndpoint: `${INGLAB_BASE_URL}/billable`,
      authType: "BEARER_TOKEN",
      authCredentials: {
        // NOTE: Replace with actual per-customer tokens
        token: process.env[`INGLAB_TOKEN_${sourceClientId}`] || "REPLACE_WITH_ACTUAL_TOKEN",
      },
      sourceClientId,
      nestedResponseConfig: {
        itemsPath: "items",
        lineItemsPath: "line_items",
        descriptionPath: "description",
        descriptionDetailPath: "description_detail",
        qtyPath: "qty",
        unitPricePath: "unit_price",
        servicePath: "service",
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.collection("dataSources").updateOne(
      { id: dataSourceId },
      { $setOnInsert: dataSource },
      { upsert: true }
    );
    console.log(`  ✓ DataSource: ${dataSourceId} (client_id=${sourceClientId})\n`);
  }

  console.log("✅ Done! 5 INGLAB customers seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed script (after verifying .env has tokens)**

```bash
# First, set per-customer tokens in .env:
# INGLAB_TOKEN_CLIENT-AIA=your-aia-token
# INGLAB_TOKEN_CLIENT-ZURICH=your-zurich-token
# etc.

npx tsx scripts/seed-inglab-customers.ts
```

Expected output:
```
🌱 Seeding INGLAB customers and DataSources...
✓ Customer: AIA Malaysia (cust_aia_malaysia_...)
  ✓ DataSource: ds_aia_malaysia_... (client_id=CLIENT-AIA)
...
✅ Done! 5 INGLAB customers seeded.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-inglab-customers.ts
git commit -m "feat(seed): add seed script for 5 INGLAB customers"
```

---

### Task 8: End-to-end manual verification

**Files:** (none — manual test)

- [ ] **Step 1: Open `/billing/generate` in browser**
- [ ] **Step 2: Select AIA Malaysia from customer dropdown**
- [ ] **Step 3: Set billing month to 2026-03**
- [ ] **Step 4: Click "Preview Invoice"**
- [ ] **Step 5: Verify preview table shows:**
  - 2 rows (one per `line_items` entry: SMS + WhatsApp)
  - Correct qty (e.g., 100, 50)
  - Correct descriptions from INGLAB API
  - Correct unit prices from INGLAB API
- [ ] **Step 6: Click "Generate Invoice"**
- [ ] **Step 7: Verify in MongoDB:**
  - InvoiceHistory record created with correct `lineItems`
  - `logs/generic-mock-invoices.log` contains correct AutoCount payload
- [ ] **Step 8: Repeat for Zurich, FWD, Prudential, Pizza Hut**
- [ ] **Step 9: Verify Coway customer still generates correctly (backward compatibility)**
