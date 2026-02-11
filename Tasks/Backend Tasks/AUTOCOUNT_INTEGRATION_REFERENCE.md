# AutoCount Cloud Accounting — Integration Reference

## Overview

This document captures all verified API details, credentials, endpoints, data mappings, and field requirements for integrating our Billing App with AutoCount Cloud Accounting's Invoice API.

---

## 1. Authentication

| Item | Value |
|---|---|
| **Key-ID** | `671f8a54-a239-4b7b-aed8-b0467c24fe2c` |
| **API-Key** | `21157001-a521-4c3a-8500-7d5100f435c3` |
| **Account Book ID** | `4013` (numeric only — the full reference `AM00004013` does NOT work in the URL) |
| **Base URL** | `https://accounting-api.autocountcloud.com/4013/` |

### Required HTTP Headers

```
Key-ID: 671f8a54-a239-4b7b-aed8-b0467c24fe2c
API-Key: 21157001-a521-4c3a-8500-7d5100f435c3
Content-Type: application/json
```

> ⚠️ **Security**: In production, these credentials MUST be stored in environment variables (`AUTOCOUNT_KEY_ID`, `AUTOCOUNT_API_KEY`, `AUTOCOUNT_ACCOUNT_BOOK_ID`), never hardcoded.

---

## 2. API Permissions (Verified)

| Endpoint | Method | Status |
|---|---|---|
| `/{id}/debtor/listing` | GET | ✅ Allowed |
| `/{id}/debtor?accNo=...` | GET | ✅ Allowed (needs `code` param for products) |
| `/{id}/product?code=...` | GET | ✅ Allowed |
| `/{id}/invoice` | POST | ✅ Allowed (to be tested) |
| `/{id}/invoice/listing` | POST | ✅ Allowed (requires `field` param) |
| `/{id}/companyProfile` | GET | ❌ 403 Forbidden |
| `/{id}/location/listing` | GET | ❌ 403 Forbidden |
| `/{id}/account/listing` | GET | ❌ 405 Not Allowed |
| `/{id}/product/listing` | GET | ❌ 405 Not Allowed |
| `/{id}/invoice/listing-simple` | GET | ❌ 404 Not Found |

---

## 3. Debtor (Customer) Registry

### 3.1 Verified Debtor: Coway

| Field | Value |
|---|---|
| **AccNo (debtorCode)** | `300-C001` |
| **CompanyName** | `Coway (Malaysia) Sdn Bhd` |
| **CurrencyCode** | `MYR` |
| **CreditTerm** | `Net 30 days` |
| **Address** | Level 20, Ilham Tower, No. 8 Jalan Binjai, 50450 Kuala Lumpur |

### 3.2 Full Debtor Listing (39 active debtors)

| AccNo | Company Name | Credit Term |
|---|---|---|
| 300-0001 | Suruhanjaya Perkhidmatan Air Negara | Net 30 days |
| 300-0002 | iLaunch Sdn. Bhd. | Net 14 days |
| 300-0003 | Hong Leong Assurance Berhad | Net 30 days |
| 300-0004 | Chagee (M) Sdn. Bhd. | Net 30 days |
| 300-0005 | EAS Taxcellent Sdn Bhd | C.O.D. |
| 300-0006 | FWD Insurance Berhad | Net 30 days |
| 300-0007 | IBM Singapore Pte Ltd | Net 14 days |
| 300-B001 | Beacon Mart Sdn Bhd | C.O.D. |
| 300-C001 | Coway (Malaysia) Sdn Bhd | Net 30 days |
| 300-C002 | Zurich Life Insurance Malaysia Berhad | Net 30 days |
| 300-C003 | Zurich General Insurance Malaysia Berhad | Net 30 days |
| 300-C004 | United Brem Sdn. Bhd. | Net 30 days |
| 300-C005 | AIG Malaysia Insurance Berhad | Net 14 days |
| 300-C006 | Lim Mong Kun | Net 14 days |
| 300-C007 | Kementerian Belia dan Sukan Malaysia | Net 30 days |
| 300-C008 | Kementerian Kerja Raya Malaysia | Net 14 days |
| 300-C009 | Community Marketplace Technology Sdn Bhd | C.O.D. |
| 300-D001 | Digital Omnis Consulting Sdn Bhd | C.O.D. |
| 300-E001 | Ecosun Energy Ventures Sdn Bhd | C.O.D. |
| 300-F001 | FWD TAKAFUL BHD | C.O.D. |
| 300-H001 | Hong Leong MSIG Takaful Berhad | C.O.D. |
| 300-H002 | Honda Malaysia Sdn Bhd | C.O.D. |
| 300-H003 | Hypedmind Sdn Bhd | C.O.D. |
| 300-H004 | H.I.S. MANAGEMENT SERVICES SDN. BHD. | C.O.D. |
| 300-I001 | Ingenious Lab Sdn. Bhd. | Net 30 days |
| 300-I002 | Ian Cleverson Plt | C.O.D. |
| 300-I003 | IMPACT Malaysia | C.O.D. |
| 300-J001 | JABATAN PEMBANGUNAN KEMAHIRAN KEMENTERIAN SUMBER MANUSIA | C.O.D. |
| 300-K001 | Kedai Ubat Dan Runcit Jin Cheong | C.O.D. |
| 300-L001 | Luchin Wellness Sdn Bhd | C.O.D. |
| 300-M001 | Malaysia Reinsurance Berhad | C.O.D. |
| 300-P001 | Pizza Hut Restaurants Sdn Bhd | C.O.D. |
| 300-P002 | Public Bank Berhad | C.O.D. |
| 300-S001 | SUN LIFE MALAYSIA ASSURANCE BERHAD | C.O.D. |
| 300-S002 | Sunrise Organic Enterprise | C.O.D. |
| 300-T001 | TC ITECH SDN BHD | Net 45 days |
| 300-W001 | Westcon Solutions(M) Sdn Bhd | C.O.D. |
| 300-W002 | Wong Mee Ling | C.O.D. |
| 300-Z001 | Zurich General Takaful Malaysia Berhad | Net 30 days |

---

## 4. Product Registry

### 4.1 Verified Product: SMS-Enhanced

| Field | Value |
|---|---|
| **productCode** | `SMS-Enhanced` |
| **productName** | `SMS Blast on ECS (Elastic Computing Service)` |
| **productType** | `S` (Service — non-inventory) |
| **price** | `0.00` (no default — must set `unitPrice` per invoice line) |
| **unit** | _(empty)_ |
| **classificationCode** | `022` |
| **supplyTaxCode** | `null` (no tax code assigned) |
| **purchaseTaxCode** | `null` |
| **status** | `A` (Active) |
| **cannotConsolidateInvoice** | `true` |
| **variants** | None |

---

## 5. Create Invoice API

### 5.1 Endpoint

```
POST https://accounting-api.autocountcloud.com/4013/invoice
```

### 5.2 Request Body Structure

The request body has 4 top-level fields:

```json
{
  "master": { ... },         // REQUIRED — invoice header
  "details": [ ... ],        // REQUIRED — line items array
  "autoFillOption": { ... }, // Optional — auto-fill toggles
  "saveApprove": null        // Optional — approval workflow
}
```

### 5.3 Master (Invoice Header)

#### Required Fields

| Field | Type | Description | Example |
|---|---|---|---|
| `docDate` | string | Invoice date (YYYY-MM-DD), must be within fiscal year | `"2026-01-31"` |
| `debtorCode` | string | Must exist in AutoCount debtor registry | `"300-C001"` |
| `debtorName` | string | Customer display name | `"Coway (Malaysia) Sdn Bhd"` |
| `creditTerm` | string | Must be a valid credit term | `"Net 30 days"` |
| `salesLocation` | string | Must be a valid location | `"HQ"` |

#### Optional Fields

| Field | Type | Description | Default |
|---|---|---|---|
| `docNo` | string | Manual doc number; if null, auto-generated | `null` |
| `docNoFormatName` | string | Numbering format name; ignored if `docNo` is set | `null` |
| `taxDate` | string | Tax date; defaults to `docDate` if null | `null` |
| `email` | string | Customer email | `null` |
| `address` | string | Billing address | `null` |
| `ref` | string | Reference number | `null` |
| `description` | string | Invoice description/memo | `null` |
| `note` | string | Internal note | `null` |
| `remark1`–`remark4` | string | Custom remark fields | `null` |
| `salesAgent` | string | Sales agent name | `null` |
| `currencyRate` | number | Exchange rate (1.0 for MYR) | `1` |
| `inclusiveTax` | boolean | Whether prices include tax | `false` |
| `isRoundAdj` | boolean | 5-cent rounding (depends on AC settings) | `false` |
| `paymentMethod` | string | For quick payment (e.g. `"CASH"`) | `null` |
| `paymentAmt` | number | Payment amount (0 = no payment) | `0` |
| `paymentRef` | string | Payment reference | `null` |

### 5.4 Details (Line Items)

Each element in the `details` array represents one invoice line.

#### Required Fields

| Field | Type | Description | Example |
|---|---|---|---|
| `accNo` | string | Sales account number (Chart of Accounts) | `"500-0000"` |

#### Common Fields

| Field | Type | Description | Example |
|---|---|---|---|
| `productCode` | string | Product code from registry | `"SMS-Enhanced"` |
| `description` | string | Line item description | `"SMS Service - Jan 2026"` |
| `qty` | number | Quantity | `66` |
| `unit` | string | Unit of measure | `"unit"` |
| `unitPrice` | number | Price per unit | `0.079` |
| `discount` | string | Discount formula (e.g. `"10%"`, `"20"`, `"10%+20"`) | `null` |
| `taxCode` | string | Supply tax code | `null` |
| `taxAdjustment` | number | Tax adjustment amount | `0` |
| `localTaxAdjustment` | number | Local tax adjustment | `0` |
| `tariffCode` | string | Tariff code | `null` |
| `localTotalCost` | number | Total cost (for inventory products) | `0` |

> **Note**: A detail line is **skipped** if ALL of: `productCode` is null, `description` is null/empty, AND `unitPrice` is 0.

### 5.5 AutoFill Options

| Field | Type | Description |
|---|---|---|
| `accNo` | boolean | If `true`, auto-fill `accNo` from Product Posting config |
| `taxCode` | boolean | If `true`, auto-fill `taxCode` from debtor/product/default |
| `tariffCode` | boolean | If `true`, auto-fill `tariffCode` from product |
| `localTotalCost` | boolean | If `true`, auto-calculate cost for inventory products |

### 5.6 Response

**Success**: `201 Created`
- Response header `location` contains the URL to the created invoice
- Example: `location: https://accounting-api.autocountcloud.com/4013/invoice?docNo=I-000001`

**Error**: JSON body with `statusCode` and `message`
- `401` — Unauthorized (bad credentials)
- `400` — Validation error (missing/invalid fields)

---

## 6. Data Mapping: Billing App → AutoCount Invoice

### 6.1 Master Mapping

| Billing App Field | AutoCount Field | Notes |
|---|---|---|
| `customer.autocountCustomerId` | `master.debtorCode` | Must match AccNo in debtor registry |
| `customer.name` | `master.debtorName` | |
| Last day of `invoice.billingMonth` | `master.docDate` | Format: `YYYY-MM-DD` |
| _(from debtor record)_ | `master.creditTerm` | Fetched from debtor or hardcoded per customer |
| _(config)_ | `master.salesLocation` | **TBD** — needs to be configured |
| `"Billing - {month}"` | `master.description` | Auto-generated description |
| `null` | `master.docNo` | Let AutoCount auto-generate |

### 6.2 Detail Line Mapping (per service)

| Billing App Field | AutoCount Field | Notes |
|---|---|---|
| Service product code (e.g. `"SMS-Enhanced"`) | `details[].productCode` | Mapped from ServiceType |
| `"{service} Service - {month}"` | `details[].description` | |
| `lineItem.billableCount` | `details[].qty` | |
| `lineItem.rate` | `details[].unitPrice` | |
| _(config)_ | `details[].accNo` | **TBD** — sales account number |
| _(config)_ | `details[].taxCode` | `null` if no tax applicable |

### 6.3 Service Type → Product Code Mapping

| ServiceType | AutoCount Product Code | Status |
|---|---|---|
| `SMS` | `SMS-Enhanced` | ✅ Verified |
| `EMAIL` | _(TBD)_ | Needs product creation in AutoCount |
| `WHATSAPP` | _(TBD)_ | Needs product creation in AutoCount |

---

## 7. Example: Test Invoice for Coway (Jan 2026)

Based on the real Recon API data (69 total SMS, 66 successful, 3 failed):

```json
{
  "master": {
    "docNo": null,
    "docNoFormatName": null,
    "docDate": "2026-01-31",
    "taxDate": null,
    "debtorCode": "300-C001",
    "debtorName": "Coway (Malaysia) Sdn Bhd",
    "creditTerm": "Net 30 days",
    "salesLocation": "HQ",
    "salesAgent": null,
    "email": null,
    "address": "Level 20, Ilham Tower,\nNo. 8 Jalan Binjai\n50450 Kuala Lumpur",
    "ref": null,
    "description": "SMS Billing - January 2026",
    "note": null,
    "remark1": null,
    "remark2": null,
    "remark3": null,
    "remark4": null,
    "currencyRate": 1,
    "inclusiveTax": false,
    "isRoundAdj": false,
    "paymentMethod": null,
    "toBankRate": 1,
    "paymentAmt": 0,
    "paymentRef": null
  },
  "details": [
    {
      "productCode": "SMS-Enhanced",
      "accNo": "500-0000",
      "description": "SMS Blast on ECS - January 2026 (66 delivered, 3 failed)",
      "qty": 66,
      "unit": "unit",
      "unitPrice": 0.079,
      "discount": null,
      "taxCode": null,
      "taxAdjustment": 0,
      "localTaxAdjustment": 0,
      "tariffCode": null,
      "localTotalCost": 0
    }
  ],
  "autoFillOption": {
    "accNo": false,
    "taxCode": false,
    "tariffCode": false,
    "localTotalCost": true
  },
  "saveApprove": null
}
```

**Expected total**: 66 × RM 0.079 = **RM 5.21**

---

## 8. Invoice Description & Further Description

There are three description fields available when creating an invoice:

### 8.1 `master.description` — Invoice-level description

| Item | Detail |
|---|---|
| **Field** | `master.description` (string) |
| **Current value** | `"Billing - 2026-01"` |
| **Purpose** | Top-level invoice memo/description visible on the invoice header |
| **Set during** | `POST /invoice` creation |

### 8.2 `details[].description` — Line item description

| Item | Detail |
|---|---|
| **Field** | `details[].description` (string) |
| **Current value** | `"SMS Service - 2026-01"` |
| **Purpose** | Description for each line item row |
| **Set during** | `POST /invoice` creation |

### 8.3 `details[].furtherDescription` — Line item extended description

| Item | Detail |
|---|---|
| **Field** | `details[].furtherDescription` (string) |
| **Current value** | `null` |
| **Purpose** | Extended/multi-line description that appears below the line item description. Useful for adding breakdown details like delivered/failed counts. |
| **Set during** | `POST /invoice` creation |

> **Example usage**: Set `furtherDescription` to `"66 delivered, 3 failed, 0 withheld"` to include a breakdown beneath the line item description.

---

## 9. e-Invoice Submission (LHDN MyInvois)

The Create Invoice API (`POST /{accountBookId}/invoice`) supports e-Invoice submission natively — no separate endpoint is needed. The e-Invoice fields are part of the **Invoice Master Input Model**.

### 9.1 Prerequisites (AutoCount Cloud UI Setup)

Before e-Invoice submission works via API, the following must be configured in the AutoCount Cloud web application:

1. **Enable e-Invoice** — Settings → e-Invoice settings ([setup guide](https://help.accounting.autocountcloud.com/support/solutions/folders/69000653783))
2. **Tax Entity for each debtor** — Each customer must have a valid Tax Entity (TIN, BRN, etc.) mapped in Debtor Maintenance
3. **Classification Code on products** — Each product must have a classification code (e.g. `022` for `SMS-Enhanced` ✅ already set)

### 9.2 e-Invoice Master Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `submitEInvoice` | boolean | No | Set to `true` to submit the invoice to LHDN MyInvois for e-Invoice validation |
| `submitConsolidatedEInvoice` | boolean | No | Set to `true` for consolidated e-Invoice (when debtor has no Tax Entity) |
| `eInvoiceIssueDateTime` | string | No (nullable) | Custom e-Invoice issue date/time |
| `eInvoiceUuid` | string | No (nullable) | UUID from LHDN — set this if the invoice was already submitted externally (prevents resubmission) |

> ⚠️ **Important**: When `eInvoiceUuid` is set with a value, the document's `submitEInvoice` is always set to `false` when saving (to prevent resubmission).

### 9.3 Additional e-Invoice Master Fields

| Field | Type | Description |
|---|---|---|
| `ShippingRecipientTaxEntity` | string (nullable) | Shipping recipient's Tax Entity |
| `FreightAllowanceCharge` | number (nullable) | Freight charge amount |
| `FreightAllowanceChargeReason` | string (nullable) | Reason for freight charge |
| `ReferenceNumberOfCustomsFormNo1And9` | string (nullable) | Customs form reference |
| `Incoterms` | string (nullable) | International trade terms |
| `FreeTradeAgreementInformation` | string (nullable) | FTA info |
| `AuthorisationNumberForCertifiedExporter` | string (nullable) | Certified exporter auth number |
| `ReferenceNumberOfCustomsFormNo2` | string (nullable) | Customs form 2 reference |

### 9.4 `saveApprove` Field

| Field | Type | Description |
|---|---|---|
| `saveApprove` | boolean (nullable) | Top-level field in the Invoice Input Model. Set to `true` to auto-approve the invoice on creation. **Only approved invoices are submitted for LHDN e-Invoice validation.** |

### 9.5 e-Invoice Submission Flow

```
1. Create invoice via API with submitEInvoice: true, saveApprove: true
2. AutoCount auto-approves the invoice
3. AutoCount automatically submits to LHDN MyInvois
4. LHDN validates and returns a UUID
5. Check e-Invoice status via AutoCount Cloud UI or GET /{accountBookId}/invoice?docNo=INV00000XXX
```

### 9.6 Example: e-Invoice Request Body

```json
{
  "master": {
    "docNo": null,
    "docDate": "2026-02-09",
    "debtorCode": "300-C001",
    "debtorName": "Coway (Malaysia) Sdn Bhd",
    "creditTerm": "Net 30 days",
    "salesLocation": "HQ",
    "description": "SMS Billing - February 2026",
    "currencyRate": 1,
    "inclusiveTax": false,
    "isRoundAdj": false,
    "submitEInvoice": true
  },
  "details": [
    {
      "productCode": "SMS-Enhanced",
      "accNo": "500-0000",
      "description": "SMS Blast on ECS - February 2026",
      "qty": 66,
      "unit": "unit",
      "unitPrice": 0.079,
      "taxCode": null
    }
  ],
  "autoFillOption": {
    "accNo": false,
    "taxCode": true,
    "tariffCode": false,
    "localTotalCost": true
  },
  "saveApprove": true
}
```

### 9.7 Conditions for e-Invoice Submission

| Condition | Individual e-Invoice | Consolidated e-Invoice |
|---|---|---|
| Document is approved | ✅ Required | ✅ Required |
| Debtor has valid Tax Entity | ✅ Required | ❌ Not required (no Tax Entity) |
| `submitEInvoice` is `true` | ✅ Required | ✅ Required |
| `submitConsolidatedEInvoice` is `true` | ❌ Not needed | ✅ Required |

### 9.8 Cancel / Void e-Invoice

To cancel an e-Invoice that has been validated by LHDN, use the Void Invoice endpoint:

```
POST /{accountBookId}/invoice/void?docNo=INV00000XXX
```

If the e-Invoice was submitted via a 3rd party system, the 3rd party system must cancel the e-Invoice document and update AutoCount via API.

### 9.9 References

- [How to submit e-Invoice (UI guide)](https://help.accounting.autocountcloud.com/support/solutions/articles/69000858873-how-to-submit-e-invoice-and-print-e-invoice-with-qr-code)
- [Set up e-Invoice in Cloud Accounting](https://help.accounting.autocountcloud.com/support/solutions/folders/69000653783)
- [Check submission summary](https://help.accounting.autocountcloud.com/support/solutions/articles/69000872401-how-to-check-the-submission-summary-and-submitted-documents-for-e-invoice)
- [LHDN MyInvois Cancel Document API](https://sdk.myinvois.hasil.gov.my/einvoicingapi/03-cancel-document/)

---

## 10. Open Items / TBD

| Item | Status | Notes |
|---|---|---|
| `salesLocation` value | ❓ TBD | Could not query locations (403). Need to confirm from AutoCount UI. Using `"HQ"` as placeholder. |
| `accNo` (sales account) | ❓ TBD | Could not query accounts (405). Using `"500-0000"` as placeholder. Need to confirm. |
| EMAIL product code | ❓ TBD | No product verified for Email service yet |
| WHATSAPP product code | ❓ TBD | No product verified for WhatsApp service yet |
| Tax code | ✅ Resolved | `SMS-Enhanced` has `supplyTaxCode: "SV-8"` (8% SST). Set `autoFillOption.taxCode = true` to auto-fill from product. |
| `docNoFormatName` | ❓ TBD | Using `null` (auto-generate). Confirm numbering format. |
| Rate limit | ℹ️ Info | API has rate limiting: `x-rate-limit-limit: 1m`, ~100 requests/min |

---

## 11. Recon Server Integration (Verified)

For reference, the Recon API that feeds data into invoices:

| Item | Value |
|---|---|
| **Recon Server** | Ali SMS2 |
| **Endpoint** | `https://sms2.g-i.com.my/api/summary` |
| **Method** | POST |
| **Auth** | `user` + `secret` in request body |
| **Verified Response (Jan 2026)** | `total: 69, successCount: 66, failed: 3, notReqToServiceProvider: 0` |

### Response Mapping

| Recon API Field | Billing App Field | AutoCount Mapping |
|---|---|---|
| `total` | `reconTotal` | — |
| `successCount` | `reconDetails.sent` | `details[].qty` (billable count) |
| `failed` | `reconDetails.failed` | Included in description |
| `notReqToServiceProvider` | `reconDetails.withheld` | Included in description |
