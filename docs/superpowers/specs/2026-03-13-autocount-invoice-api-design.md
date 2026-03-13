# AutoCount Invoice Integration API - Design Specification

**Date:** 2026-03-13
**Status:** Approved

---

## 1. Project Overview

Build a Next.js API Route Handler to orchestrate data from the INGLAB Partner API and generate a formatted Excel file for AutoCount bulk import. The service will be integrated into the existing billing-app as Next.js API routes.

---

## 2. API Structure

### Endpoint

```
GET /api/autocount/generate-excel
```

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | Yes | Billing period in YYYY-MM format (e.g., "2026-03") |
| `mode` | string | No | `"download"` (default) or `"save"` |

### Responses

**Download Mode (default):**
- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Content-Disposition: `attachment; filename="autocount-invoice-2026-03.xlsx"`

**Save Mode:**
```json
{
  "success": true,
  "filePath": "/exports/autocount-invoice-2026-03-1699999999.xlsx",
  "period": "2026-03",
  "recordCount": 5,
  "savedAt": "2026-03-13T10:00:00Z"
}
```

---

## 3. Technical Configuration

### Environment Variables (.env.local)

```env
# AutoCount API
# Bearer token for authentication
AUTOCOUNT_API_TOKEN=bda81890-f098-4998-85a8-358a2aeb6de1
# Full base URL including partner path (INGLAB partner)
AUTOCOUNT_BASE_URL=https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB
```

### Authentication

All external API requests include the Bearer token:
```
Authorization: Bearer {AUTOCOUNT_API_TOKEN}
```

### External API Endpoints

- **Client Master Data:** `GET {AUTOCOUNT_BASE_URL}/clients`
- **Billable Items:** `GET {AUTOCOUNT_BASE_URL}/billable?period={period}`

**Note:** Based on the Partner API documentation, responses are not paginated. Assume all data is returned in a single response. If pagination is needed in the future, the implementation should be updated.

---

## 4. Data Flow

```
1. Receive request with period and mode
       │
       ▼
2. Fetch client master data from Partner API
       │
       ▼
3. Fetch billable items for given period
       │
       ▼
4. Filter: keep only items where source_client_name === "AIA Malaysia"
       │
       ▼
5. Transform each line_item to AutoCount schema
       │
       ▼
6. Generate Excel with all 52 headers (16 standard + 3 AIA Malaysia + 33 empty)
       │
       ▼
7a. Download mode → stream Excel to client
7b. Save mode → write to /exports, return path
```

---

## 5. Excel Field Mapping

### Standard Fields

| AutoCount Header | Value / Logic |
| :--- | :--- |
| DocNo | `"<>"` (AutoCount placeholder for auto-generate document number) |
| DocDate | Current date (DD/MM/YYYY) |
| TaxDate | Current date (DD/MM/YYYY) |
| SalesLocation | `"HQ"` |
| SalesAgent | `"Darren Lim"` |
| CreditTerm | `"Next 30 Days"` |
| Description | `"INVOICE"` |
| InclusiveTax | `"FALSE"` |
| SubmitEInvoice | `"FALSE"` |
| ProductCode | `"MODE-WA-API"` |
| AccNo | `"500-0000"` |
| ClassificationCode | `"22"` |
| TaxCode | `"SV-8"` |
| DetailDescription | `line_item.description` |
| Qty | `line_item.qty` |
| Unit | `line_item.unit` |
| UnitPrice | `line_item.unitprice` |
| LocalTotalCost | `line_item.totalAmount` |

### Expected API Response Fields

The `/billable` endpoint returns items with the following structure (per API docs):

```json
{
  "id": "draft-SERVICE-001-PARTNER-2026-03-01",
  "service_id": "SERVICE-001",
  "client_id": "INGLAB",
  "client_name": "Partner Company",
  "source_client_id": "CLIENT-001",
  "source_client_name": "Original Client",
  "billing_target": "PARTNER",
  "service": "WhatsApp Business API",
  "period_start": "2026-03-01",
  "period_end": "2026-03-31",
  "bill_date": "2026-04-01",
  "currency": "MYR",
  "line_items": [
    {
      "description": "Service description",
      "qty": 1,
      "unit": "month",
      "unitprice": 100.00,
      "totalAmount": 100.00
    }
  ]
}
```

**Fields used in Excel mapping:**
- `source_client_name` - Used to filter for "AIA Malaysia"
- `line_items[].description` → `DetailDescription`
- `line_items[].qty` → `Qty`
- `line_items[].unit` → `Unit`
- `line_items[].unitprice` → `UnitPrice`
- `line_items[].totalAmount` → `LocalTotalCost`

### Date Handling

- **DocDate / TaxDate:** Server's current date at time of execution (DD/MM/YYYY format)
- Example: If generated on 2026-03-13, value is "13/03/2026"

### Duplicate Handling

- **No deduplication:** Each billable item is processed as-is
- If the same line_item appears multiple times, each will be a separate row in the Excel output
- This allows AutoCount to handle any business logic for duplicates

### API Timeout

- **Request timeout:** 30 seconds per external API call
- If timeout occurs, return 502 with error details

### Logging

- **Skipped records:** Log at `warn` level when a billable item is skipped (non-AIA Malaysia)
- **Format:** `{ timestamp: ISO8601, level: "warn", reason: "non_aia_client", source_client_name: "..." }`
- **Successful generation:** Log at `info` level with record count and period

### AIA Malaysia Special Fields

When `source_client_name === "AIA Malaysia"`:

| Field | Value |
| :--- | :--- |
| DebtorCode | `"300-0001"` |
| TaxEntity | `"Tax Entity: C20395547010"` |
| Address | `"Level 19, Menara AIA, 99, Jalan Ampang, 50450 Kuala Lumpur, Malaysia."` |

### Mandatory Empty Headers (33 columns)

```
TaxExemptionExpiryDate, PaymentMethod, PaymentRef, PaymentAmt, Email, EmailCC,
EmailBCC, Attention, Phone1, Fax1, DeliverAddress, DeliverContact, DeliverPhone1,
DeliverFax1, Ref, Note, Remark1, Remark2, Remark3, Remark4, CurrencyRate,
ToTaxCurrencyRate, ToBankRate, ShippingRecipientTaxEntity, FreightAllowanceCharge,
FreightAllowanceChargeReason, ReferenceNumberOfCustomsFormNo1And9,
FreeTradeAgreementInformation, ReferenceNumberOfCustomsFormNo2, Incoterms,
AuthorisationNumberForCertifiedExporter, EInvoiceIssueDateTime, EInvoiceUuid,
ProductVariant, FurtherDescription, DeptNo, Discount, UnitType, TaxExportCountry,
TaxPermitNo, TaxAdjustment, LocalTaxAdjustment, TariffCode, YourPONo, YourPODate,
OriginCountry
```

---

## 6. Error Handling

| Scenario | HTTP Status | Response |
| :--- | :--- | :--- |
| Missing `period` param | 400 | `{ "error": "Missing required parameter: period" }` |
| Invalid period format | 400 | `{ "error": "Invalid period format. Use YYYY-MM" }` |
| Invalid `mode` param | 400 | `{ "error": "Invalid mode. Use 'download' or 'save'" }` |
| API token missing/invalid | 401 | `{ "error": "Unauthorized: Invalid or missing API token" }` |
| External API call fails | 502 | `{ "error": "Failed to fetch from Partner API", "details": "..." }` |
| Client master data returns empty | 502 | `{ "error": "Failed to fetch client master data", "details": "..." }` |
| No matching billable items (no AIA Malaysia) | 200 | Empty Excel file with headers (no error) |
| Save mode: write fails | 500 | `{ "error": "Failed to save file", "details": "..." }` |

---

## 7. File Storage

- **Directory:** `{project-root}/exports/`
- **Implementation:** Create directory if it does not exist
- **Filename pattern:** `autocount-invoice-{period}-{unix_timestamp}.xlsx`
- **Example:** `autocount-invoice-2026-03-1699999999.xlsx`
- **Timestamp:** Unix epoch (seconds since 1970-01-01)

---

## 8. Acceptance Criteria

1. ✅ Service successfully authenticates using the Bearer token from env
2. ✅ `/clients` and `/billable` endpoints are called in sequence
3. ✅ AIA Malaysia specific mapping is applied correctly
4. ✅ Non-AIA Malaysia records are skipped (logged as warning)
5. ✅ Output is a valid .xlsx file where one line_item = one row
6. ✅ All 52 headers (16 standard + 3 AIA Malaysia + 33 empty) are present in the final Excel file
7. ✅ Download mode returns Excel file directly
8. ✅ Save mode writes file to /exports and returns path
9. ✅ Invalid requests return appropriate error responses

---

## 9. File Structure

```
billing-app/
├── src/
│   └── app/
│       └── api/
│           └── autocount/
│               └── generate-excel/
│                   └── route.ts       # Main API handler
├── exports/                           # Generated Excel files (gitignored)
└── .env.local                         # Configuration
```
