# Gap Analysis: Coway (Malaysia) Sdn Bhd Billing Export

**Date:** 2026-03-15
**Author:** Claude
**Status:** Research Complete - Awaiting Implementation Plan

---

## 1. Executive Summary

This document outlines the gap analysis for adding Coway (Malaysia) Sdn Bhd to the billing export system at `/billing-export`. The system currently supports INGLAB-sourced clients and needs to be extended to fetch data from a new source: Coway API (`https://sms2.g-i.com.my/api/summaryv2`) combined with MongoDB customer configuration.

---

## 2. Current System Overview

### 2.1 Existing INGLAB Clients

| Item | Details |
|------|---------|
| Data Source | `https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB` |
| Authentication | Bearer token (configured in `.env.local`) |
| Supported Clients | AIA Malaysia, Zurich Malaysia, FWD Takaful, Prudential Malaysia, Pizza Hut |
| CSV Output | 57 columns (AutoCount format) |
| TaxCode | SV-8 (standard) |

### 2.2 Existing Data Flow (INGLAB)

```
INGLAB API → fetchIngLabBillable() → generatePreview() → generateCSV() → AutoCount CSV
                    ↓
           IngLabBillableItem[]
           - source_client_name
           - line_items[]
             - description
             - description_detail
             - qty
             - unit_price
```

### 2.3 Existing AutoCount CSV Format

| CSV Column | Source |
|------------|--------|
| DocNo | "<<New>>" for first line, empty for subsequent |
| DocDate | Current date (DD/MM/YYYY) |
| TaxDate | Same as DocDate |
| SalesLocation | DB default: "HQ" |
| SalesAgent | DB default: "Darren Lim" |
| CreditTerm | DB default: "Net 30 days" |
| Description | "INVOICE" |
| DebtorCode | From BillingClient DB |
| TaxEntity | From BillingClient DB |
| Address | From BillingClient DB |
| ProductCode | DB default: "MODE-WA-API" |
| AccNo | DB default: "500-0000" |
| ClassificationCode | DB default: "'022" |
| TaxCode | DB default: "SV-8" |
| DetailDescription | From line item |
| FurtherDescription | From line item |
| Qty | From line item |
| Unit | From line item |
| UnitPrice | From line item |
| LocalTotalCost | qty × unit_price |
| + 37 mandatory empty columns | Empty |

---

## 3. Coway Requirements

### 3.1 Data Sources (Multi-Source)

| Data Element | Source | Field/Value |
|--------------|--------|-------------|
| ProductCode | MongoDB `customers` collection | `serviceProductOverrides[].productCode` for SMS → "SMS-Enhanced" |
| DetailDescription | MongoDB `customers` collection | `furtherDescriptionTemplate` with placeholders |
| UnitPrice | MongoDB `customers` collection | `rates.SMS` → 0.079 |
| Quantity | Coway API (`https://sms2.g-i.com.my/api/summaryv2`) | `total` field |
| LocalTotalCost | Calculated | total × UnitPrice |

### 3.2 Coway API Details

**Endpoint:** `https://sms2.g-i.com.my/api/summaryv2`

**Method:** POST

**Authentication:**
```json
{
  "user": "gi_xHdw6",
  "secret": "VpHVSMLS1E4xa2vq7qtVYtb7XJIBDB",
  "serviceProvider": "gts",
  "dtFrom": "2026-03-01 00:00:00",
  "dtTo": "2026-03-31 23:59:59"
}
```

**Response:**
```json
{
  "success": true,
  "total": 3155640,
  "successCount": 3125082,
  "failed": 30558,
  "notReqToServiceProvider": 30548
}
```

### 3.3 MongoDB Customer Configuration

The customer record in MongoDB must contain:

| Field | Value |
|-------|-------|
| `name` | "Coway (Malaysia) Sdn Bhd" |
| `serviceProductOverrides` | `[{ serviceType: "SMS", productCode: "SMS-Enhanced" }]` |
| `furtherDescriptionTemplate` | "For {BillingCycle}, the total number of SMS messages sent via ECS Service was {SMSCount}, charged at RM {SMSRate} per message." |
| `rates` | `{ SMS: 0.079 }` |

### 3.4 AutoCount CSV Mapping for Coway

| CSV Column | Value |
|------------|-------|
| DebtorCode | "300-C001" |
| TaxEntity | "TIN:C12113374050" |
| Address | "Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur" |
| TaxCode | **"SV-6"** (different from standard "SV-8") |
| ProductCode | "SMS-Enhanced" (from MongoDB) |
| Description | "INVOICE" |

---

## 4. Gap Analysis

### 4.1 Components to Create/Modify

| # | Component | Type | Description |
|---|-----------|------|-------------|
| 1 | `cowayClient.ts` | New | External API client to fetch data from Coway API |
| 2 | `billingExportService.ts` | Modify | Add Coway to SUPPORTED_CLIENTS, handle multi-source data fetching |
| 3 | BillingClient DB | Modify | Add Coway client mapping with SV-6 tax code |
| 4 | BillingDefaults DB | Modify | Add Coway-specific defaults if needed |
| 5 | `billing-export/page.tsx` | Modify | Add "Coway (Malaysia) Sdn Bhd" to dropdown |
| 6 | `generatePreview()` | Modify | Route to appropriate data source based on client |
| 7 | `generateCSV()` | Modify | Apply SV-6 tax code for Coway |

### 4.2 Pre-requisites

| # | Pre-requisite | Status | Notes |
|---|----------------|--------|-------|
| 1 | Coway API authentication | ✅ Complete | Secret key provided |
| 2 | Coway API response structure | ✅ Complete | Returns total, successCount, failed |
| 3 | MongoDB customer record | ⚠️ Pending | Need to verify if "Coway (Malaysia) Sdn Bhd" exists in MongoDB |
| 4 | AutoCount mapping | ✅ Complete | All fields provided |
| 5 | Placeholder resolution | ❓ Pending | `{BillingCycle}`, `{SMSCount}`, `{SMSRate}` - user mentioned these need to be specified in another conversation |

### 4.3 Placeholder Resolution Required

The `furtherDescriptionTemplate` contains placeholders that need to be resolved at runtime:

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{BillingCycle}` | Billing period | "March 2026" |
| `{SMSCount}` | From Coway API `total` field | "3,155,640" |
| `{SMSRate}` | From MongoDB `rates.SMS` | "0.079" |

**Note:** User indicated these placeholders need to be specified in another conversation.

---

## 5. Implementation Approach

### Option A: Separate Client Handler (Recommended)

Create a dedicated Coway data handler that:
1. Fetches usage count from Coway API
2. Fetches customer config from MongoDB
3. Merges data into a standard format compatible with existing `generateCSV()`

**Pros:**
- Clean separation of concerns
- Easy to extend for future non-INGLAB clients
- Minimal changes to existing code

**Cons:**
- More initial development time

### Option B: Inline Conditional Logic

Add if/else logic in existing `generatePreview()` to handle Coway differently.

**Pros:**
- Quick to implement
- Fewer files

**Cons:**
- Code becomes harder to maintain
- Violates single responsibility

---

## 6. Questions for Clarification

1. **MongoDB Customer:** Does the customer "Coway (Malaysia) Sdn Bhd" already exist in the MongoDB `customers` collection, or do we need to create it?

2. **Placeholder Values:** Please confirm the values for the placeholders in `furtherDescriptionTemplate`:
   - `{BillingCycle}` - format (e.g., "March 2026", "2026-03")?
   - `{SMSCount}` - should it include thousands separator?
   - `{SMSRate}` - should it show as "0.079" or "0.08"?

3. **Multiple Service Types:** Will Coway ever have services beyond SMS (e.g., EMAIL, WHATSAPP)? The current design assumes SMS-only.

---

## 7. Next Steps

1. Confirm MongoDB customer record exists
2. Resolve placeholder values
3. Create implementation plan (invoke `writing-plans` skill)
4. Implement Option A (recommended)

---

## Appendix: Files to Modify

```
billing-app/src/
├── infrastructure/
│   └── external/
│       └── cowayClient.ts          [NEW]
├── domain/
│   └── services/
│       └── billingExportService.ts [MODIFY]
├── infrastructure/db/
│   └── billingClientRepository.ts  [MODIFY - add Coway to DB]
└── app/
    └── billing-export/
        └── page.tsx                 [MODIFY - add to dropdown]
```
