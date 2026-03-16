# UI Consistency & Preview Feature Design

> **Status:** Final
> **Date:** 2026-03-16

## Overview

Refactor `/billing/generate-invoice` page to match the layout and functionality of `/billing-export`, and add a preview feature to display invoice line items before generation.

## Goals

1. **UI Consistency**: Make `/billing/generate-invoice` follow the same layout pattern as `/billing-export`
2. **Preview Feature**: Add ability to preview invoice line items before generating to AutoCount

---

## Current State

### `/billing-export` Layout
- Header with navigation buttons (Clients, Settings, History)
- Control Panel Card with form inputs
- Preview Section with table showing line items
- Recent Exports section with history table

### `/billing/generate-invoice` Layout (Current)
- Simple centered card
- Customer display (hardcoded to Coway)
- Billing Month input
- Generate button
- Result alert

---

## Proposed Changes

### 1. UI Layout Refactor

Update `/billing/generate-invoice/page.tsx` to match `/billing-export` structure:

#### Header
- Title: "AutoCount Invoice Generation"
- Navigation buttons: Clients, Settings, History (linking to /billing-export/*)
- Style: Consistent with /billing-export header
- **Note**: These links go to /billing-export/* pages for consistency across the billing module

#### Control Panel Card
- **Customer Selection**: Display "Coway (Malaysia) Sdn Bhd" (read-only for v1 - single customer)
- **Billing Month**: Month picker input
- **Preview Button**: Opens preview section
- **Generate Button**: Triggers invoice generation

**Error Handling**:
- Empty billing month: Show validation error "Please select a billing month"
- API errors: Show error message in alert
- No line items: Show message "No billing data found for selected period"

#### Preview Section (New)
- **Trigger**: Preview button click
- **Display**: Table with invoice line items
- **Columns** (snake_case to match /billing-export):
  | Column | Source |
  |--------|--------|
  | doc_no | Auto-generated (preview placeholder: "PREVIEW-XXX") |
  | doc_date | Today's date in DD/MM/YYYY |
  | debtor_code | From customer config (AutoCountDebtorCode field) |
  | product_code | From service product mapping (AutoCountProductCode) |
  | detail_description | Service type description (e.g., "Water Filter Rental") |
  | further_description | From service mapping or billing mode |
  | qty | From billing mode: LUMP_SUM=1, ITEMIZED=service count |
  | unit_price | From billing mode: LUMP_SUM=totalCharge, ITEMIZED=service rate |
  | local_total_cost | Calculated: Qty × UnitPrice |

- **Behavior**: Shows first 50 rows, indicates if more exist (e.g., "... and X more rows")

#### Recent Exports Section
- Table showing last 10 invoice generations
- Columns: Period, Client, Rows, Status, Date (matching /billing-export)
- **Data Source**: Use existing `/api/history` endpoint which uses `invoiceRepository.findAllInvoices()`
- **API Response**: The endpoint returns `{ invoices: [...] }` - frontend needs to access `data.invoices`
- **Column Mapping**:
  - Period → billingMonth
  - Client → customerName
  - Rows → lineItems.length
  - Status → status
  - Date → createdAt

**Post-Generate Behavior**:
- Show success/error alert with DocNo on success
- Automatically refresh Recent Exports section

### 2. API Changes

#### New Endpoint: `/api/invoices/preview`

**Purpose**: Return invoice line items without generating in AutoCount

**Request**:
```json
{
  "billingMonth": "2026-03",
  "customerId": "optional-customer-id"
}
```

**Response** (snake_case to match /billing-export API format):
```json
{
  "period": "2026-03",
  "customer": "Coway (Malaysia) Sdn Bhd",
  "total_rows": 25,
  "data": [
    {
      "doc_no": "PREVIEW-001",
      "doc_date": "16/03/2026",
      "debtor_code": "COWAY001",
      "product_code": "WATER001",
      "detail_description": "Water Filter Rental",
      "further_description": "Monthly rental",
      "qty": 1,
      "unit_price": 150.00,
      "local_total_cost": 150.00
    }
  ]
}
```

**Error Responses**:
- `400`: Invalid billing month format
- `404`: No billing data found for period
- `500`: Server error

**Implementation**:
- Reuse `buildAutoCountInvoice()` from `@/domain/services/autocountInvoiceBuilder` for line item construction
- Return preview data without calling AutoCount API
- Generate preview DocNo as "PREVIEW-XXX"

---

## File Changes

| File | Change |
|------|--------|
| `src/app/billing/generate-invoice/page.tsx` | Refactor layout to match /billing-export |
| `src/app/api/invoices/preview/route.ts` | New API endpoint - returns invoice line items without generating |
| `/api/history` (existing) | Serves Recent Exports data via invoiceRepository.findAllInvoices() |

## Implementation Notes

- This is a **refactor** of existing /billing/generate-invoice - the Generate button behavior remains the same (calls `/api/invoices/generate-auto`)
- Preview uses the same line item construction logic as the generate endpoint but returns data without calling AutoCount API
- Use `/api/history` endpoint for Recent Exports (serves invoice generation history)

---

## Acceptance Criteria

1. `/billing/generate-invoice` has header with navigation buttons
2. Control panel has Customer dropdown, Billing Month, Preview, and Generate buttons
3. Preview button shows table with line items
4. Preview table shows all requested columns
5. Recent exports section displays history
6. `/api/invoices/preview` endpoint works correctly
7. UI styling matches `/billing-export` exactly
