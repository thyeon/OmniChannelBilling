# Invoice Actions - Preview, Payload, Submit Design

> **Status:** Final
> **Date:** 2026-03-16

## Overview

Add 3 action buttons (Preview, Payload, Submit) to each invoice record in the Recent Invoices section at `/billing/generate-invoice`. These buttons enable users to review invoice line items, inspect/edit the AutoCount API payload before submission, and submit to AutoCount.

## Goals

1. **Preview:** Show invoice line items in the same format as existing Preview feature
2. **Payload:** Display/edit AutoCount API JSON payload before submitting
3. **Submit:** Send payload to AutoCount and update status (SYNCED on success, Retry on failure)

---

## Current State

### Existing Functionality
- `/billing/generate-invoice` has "Recent Invoices" table showing: Period, Customer, Status, DocNo, Date
- Preview feature exists at `/api/invoices/preview` - returns formatted line items
- Retry-sync endpoint exists at `/api/invoices/[id]/retry-sync` - only works for ERROR status

### Invoice Statuses
| Status | Meaning |
|--------|---------|
| DRAFT | Invoice created but not synced to AutoCount |
| GENERATED | Invoice synced to AutoCount (success) |
| SYNCED | Same as GENERATED (alias) |
| ERROR | Failed to sync to AutoCount |

---

## Proposed Changes

### UI Layout

Each invoice row in "Recent Invoices" will have 3 action buttons in a button group:

```
| Period | Customer | Status | DocNo | Date | Actions |
|--------|----------|--------|-------|------|---------|
| 2026-02 | Coway (M) | DRAFT | - | 16/3 | [Preview] [Payload] [Submit] |
| 2026-01 | Coway (M) | SYNCED | INV-001 | 15/2 | [Preview] [Payload] [Submit] |
| 2026-01 | Coway (M) | ERROR | - | 15/2 | [Preview] [Payload] [Retry] |
```

### Button Visibility by Status

| Status | Preview | Payload | Submit/Retry |
|--------|---------|---------|--------------|
| DRAFT | ✅ | ✅ | ✅ (Submit) |
| GENERATED | ✅ | ✅ | ❌ (disabled) |
| SYNCED | ✅ | ✅ | ❌ (disabled) |
| ERROR | ✅ | ✅ | ✅ (Retry) |

### Button 1: Preview

**Purpose:** Show invoice line items in table format

**Trigger:** Click "Preview" button

**Display:** Modal with table showing line items

**Data Source:** Use new endpoint `/api/invoices/[id]/preview` which reads from stored `invoice.lineItems`

**Note:** The existing `/api/invoices/preview` fetches fresh data from external services. For existing invoices, we use stored lineItems to show what was actually billed (not rebuilt data).

**Columns (same as existing Preview):**
| Column | Source |
|--------|--------|
| doc_no | Auto-generated: `INV-{index}` or stored `autocountRefId` |
| doc_date | From invoice record |
| debtor_code | From customer config |
| product_code | From service product mapping |
| detail_description | Service type description |
| further_description | From service mapping |
| qty | billableCount |
| unit_price | unitPrice |
| local_total_cost | totalCharge |

**Data Source:**
- Use existing `/api/invoices/preview` logic
- Pass `billingMonth` and `customerId` to rebuild preview format from stored lineItems

### Button 2: Payload

**Purpose:** Display and edit AutoCount API JSON payload before submission

**Trigger:** Click "Payload" button

**Display:** Modal with JSON editor

**Features:**
1. **View:** Pre-populated with AutoCount API payload (JSON format)
2. **Edit:** User can modify JSON in textarea
3. **Save:** "Save" button stores custom payload to database
4. **Submit:** "Submit" button sends payload to AutoCount

**JSON Format (AutoCount API payload):**
```json
{
  "master": {
    "docNo": "INV-001",
    "docDate": "16/03/2026",
    "debtorCode": "300-C001",
    "description": "Coway (Malaysia) Sdn Bhd - February 2026",
    "currencyCode": "MYR"
  },
  "details": [
    {
      "productCode": "SMS-001",
      "description": "SMS Blast - February 2026",
      "qty": 1000,
      "unitPrice": 0.079,
      "localTotalCost": 79.00
    }
  ],
  "autoFillOption": {
    "autoFillTax": true,
    "autoFillDiscount": true
  },
  "saveApprove": null
}
```

**Note:** The `autoFillOption` and `saveApprove` fields are required by AutoCount API. The UI displays a simplified view; actual submission uses the full format.

**Storage:** New field `customPayload?: string` in InvoiceHistory

### Button 3: Submit / Retry

**Purpose:** Submit payload to AutoCount and update status

**Trigger:** Click "Submit" (DRAFT) or "Retry" (ERROR)

**Behavior by Status:**

| Current Status | Action | Success | Failure |
|----------------|--------|---------|---------|
| DRAFT | Submit to AutoCount | Status → SYNCED, store DocNo | Status → ERROR |
| ERROR | Retry sync | Status → SYNCED, store DocNo | Status → ERROR (remain) |

**On Success:**
- Update status to `SYNCED`
- Store `autocountRefId` from AutoCount response
- Clear `syncError`

**On Failure:**
- Keep status as `ERROR`
- Store error message in `syncError`
- Show error alert in UI

---

## API Changes

### 1. New: GET /api/invoices/[id]/preview

**Purpose:** Get preview data from stored lineItems (not from external services)

**Response:**
```json
{
  "invoiceId": "...",
  "billingMonth": "2026-02",
  "customer": "Coway (Malaysia) Sdn Bhd",
  "total_rows": 3,
  "data": [
    {
      "doc_no": "INV-001",
      "doc_date": "16/03/2026",
      "debtor_code": "300-C001",
      "product_code": "SMS-001",
      "detail_description": "SMS Blast - February 2026",
      "further_description": "...",
      "qty": 1000,
      "unit_price": 0.079,
      "local_total_cost": 79.00
    }
  ]
}
```

### 2. New: GET /api/invoices/[id]/payload

**Purpose:** Get AutoCount payload for an invoice

**Response:**
```json
{
  "invoiceId": "...",
  "billingMonth": "2026-02",
  "customerName": "Coway (Malaysia) Sdn Bhd",
  "payload": {
    "master": { ... },
    "details": [ ... ]
  },
  "hasCustomPayload": true
}
```

### 3. New: PUT /api/invoices/[id]/payload

**Purpose:** Save custom payload for an invoice

**Request:**
```json
{
  "payload": { "master": {}, "details": [] }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Custom payload saved"
}
```

### 4. New: POST /api/invoices/[id]/submit

**Purpose:** Submit payload to AutoCount (for DRAFT status)

**Why separate from retry-sync:**
- `retry-sync` is for invoices with ERROR status - they already have stored lineItems and were previously attempted
- `submit` is for DRAFT status - new invoices that haven't been synced yet
- The existing retry-sync explicitly rejects non-ERROR status (lines 29-35 in route.ts)
- This separation keeps concerns clear: retry = fix previous failure, submit = new submission

**Request:**
```json
{
  "useCustomPayload": true  // optional, default false
}
```

**Response (success):**
```json
{
  "success": true,
  "status": "SYNCED",
  "docNo": "INV-001"
}
```

**Response (failure):**
```json
{
  "success": false,
  "status": "ERROR",
  "error": "AutoCount API error message"
}
```

### 5. Existing: POST /api/invoices/[id]/retry-sync

**Purpose:** Retry sync for ERROR status (already exists, no changes needed)

---

## Data Model Changes

### InvoiceHistory Type Update

```typescript
export interface InvoiceHistory {
  // ... existing fields
  customPayload?: string;  // NEW: stores user-edited AutoCount payload
}
```

---

## File Changes

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `customPayload` field to InvoiceHistory |
| `src/app/api/invoices/[id]/preview/route.ts` | NEW: GET preview from stored lineItems |
| `src/app/api/invoices/[id]/payload/route.ts` | NEW: GET/PUT for payload |
| `src/app/api/invoices/[id]/submit/route.ts` | NEW: POST for submit |
| `src/app/billing/generate-invoice/page.tsx` | Add 3 buttons to Recent Invoices table |

---

## Acceptance Criteria

1. ✅ Each invoice row shows 3 buttons: Preview, Payload, Submit/Retry
2. ✅ Buttons are enabled/disabled based on invoice status
3. ✅ Preview shows line items in same format as existing Preview feature (from stored lineItems)
4. ✅ Payload shows AutoCount JSON format, allows editing
5. ✅ Edited payload is saved to database
6. ✅ Submit sends to AutoCount and updates status to SYNCED on success
7. ✅ Retry shows for ERROR status, works correctly
8. ✅ UI is consistent with existing design
9. ✅ Minimal changes to existing working code
10. ✅ New `/api/invoices/[id]/preview` endpoint returns stored lineItems

---

## Implementation Notes

- Reuse existing `/api/invoices/preview` logic for Preview format
- Reuse existing `buildAutoCountInvoice` for Payload generation
- Submit endpoint similar to existing retry-sync but for DRAFT status
- Modal components can use existing UI patterns from the app
