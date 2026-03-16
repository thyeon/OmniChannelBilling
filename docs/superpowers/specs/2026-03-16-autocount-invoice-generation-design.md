# Generate Invoice to AutoCount - Design Document

**Date:** 2026-03-16
**Status:** Draft (v2 - Updated based on review feedback)

## 1. Overview

Rewrite the "Generate Invoice" feature to integrate directly with AutoCount Cloud Accounting API using the same data fetching and mapping logic as the CSV Export feature for Coway (Malaysia) Sdn Bhd.

## 2. Goals

- Generate invoices directly in AutoCount via API (not CSV upload)
- Use the same data fetching logic as CSV Export:
  - Fetch SMS billable data from Coway API
  - Fetch WhatsApp billable from recon server
  - Fetch Email billable from recon server
- Use saved rates from customer configuration in MongoDB
- Create complete, valid invoices in AutoCount

## 3. Scope (Initial Release)

**Phase 1 (This Implementation):** Coway (Malaysia) Sdn Bhd only
- Other clients (AIA, Zurich, FWD, etc.) will be addressed in future phases

## 4. User Flow

1. User navigates to Billing > Generate Invoice
2. User selects Customer (only "Coway (Malaysia) Sdn Bhd" in v1)
3. User selects Billing Month (e.g., "2026-02")
4. User clicks "Generate Invoice"
5. System:
   - Fetches customer config from MongoDB
   - Validates customer has AutoCount configuration
   - Checks for duplicate invoice (customer + billingMonth)
   - Fetches billable data:
     - SMS from Coway API
     - WhatsApp from recon server
     - Email from recon server
   - Uses rates from customer config
   - Builds AutoCount invoice payload
   - Calls AutoCount API
6. System shows success with AutoCount document number, or error details

## 5. Architecture

### 5.1 Components

| Component | Responsibility |
|-----------|----------------|
| `/app/billing/generate-invoice/page.tsx` | UI for selecting customer + billing month |
| `/app/api/invoices/generate-auto/route.ts` | New API endpoint |
| `cowayBillingService.ts` (NEW) | Fetches billable data for Coway |
| `autocountInvoiceBuilder.ts` | Existing - builds AutoCount payload |
| `autocountClient.ts` | Existing - calls AutoCount API |

### 5.2 Data Flow

```
User Selection (Customer + Month)
         │
         ▼
┌─────────────────────────────────────────────┐
│  /api/invoices/generate-auto               │
│  1. Validate customer + billingMonth       │
│  2. Check for duplicate invoice            │
│  3. Fetch customer config from MongoDB     │
│  4. Validate AutoCount config              │
│  5. Fetch billable data (new service)     │
│     - fetchCowayBillable()               │
│     - fetchWhatsAppBillable()            │
│     - fetchEmailReconSummary()            │
│  6. Build InvoiceLineItem[]               │
│  7. Build AutoCount payload               │
│  8. Call AutoCount API                    │
└─────────────────────────────────────────────┘
         │
         ▼
  Invoice created in AutoCount
```

## 6. Implementation Details

### 6.1 New API Endpoint

**Route:** `POST /api/invoices/generate-auto`

**Request Body:**
```typescript
{
  customerId: string;      // Customer ID from MongoDB
  billingMonth: string;    // Format: "2026-02"
}
```

**Response:**
```typescript
{
  success: boolean;
  invoice?: {
    id: string;
    customerName: string;
    billingMonth: string;
    totalAmount: number;
    status: "SYNCED" | "ERROR";
    autocountRefId?: string;
    syncError?: string;
  };
  error?: string;
}
```

### 6.2 New Service: cowayBillingService.ts

Create a new service that directly fetches billable data based on customer config:

```typescript
// /domain/services/cowayBillingService.ts

interface CowayBillableResult {
  service: "SMS" | "WHATSAPP" | "EMAIL";
  billableCount: number;
  rate: number;
  totalCharge: number;
  description: string;
  furtherDescription: string;
}

/**
 * Fetch all billable data for Coway customer
 * Uses customer config for rates and product codes
 */
export async function fetchCowayBillableData(
  customer: Customer,
  billingMonth: string
): Promise<CowayBillableResult[]> {
  const results: CowayBillableResult[] = [];

  // 1. Fetch SMS from Coway API
  const smsItems = await fetchCowayBillable(billingMonth);
  if (smsItems.length > 0 && smsItems[0].line_items[0].qty > 0) {
    const rate = customer.rates?.SMS || 0.079;
    const productOverride = customer.serviceProductOverrides?.find(
      o => o.serviceType === "SMS"
    );
    const productCode = productOverride?.productCode || "SMS-Enhanced";

    // Resolve description template
    const template = customer.furtherDescriptionTemplate || "";
    const billingCycle = getBillingCycle(billingMonth);
    const furtherDesc = resolveTemplate(template, {
      BillingCycle: billingCycle,
      SMSCount: smsItems[0].line_items[0].qty.toLocaleString(),
      SMSRate: rate.toFixed(3),
    });

    results.push({
      service: "SMS",
      billableCount: smsItems[0].line_items[0].qty,
      rate,
      totalCharge: smsItems[0].line_items[0].qty * rate,
      description: productCode,
      furtherDescription: furtherDesc,
    });
  }

  // 2. Fetch WhatsApp from recon server
  const whatsappReconServer = customer.reconServers?.find(r => r.type === "WHATSAPP");
  if (whatsappReconServer) {
    try {
      const whatsappCount = await fetchWhatsAppBillable(billingMonth, whatsappReconServer);
      if (whatsappCount > 0) {
        const rate = customer.rates?.WHATSAPP || 0.079;
        const productOverride = customer.serviceProductOverrides?.find(
          o => o.serviceType === "WHATSAPP"
        );
        const productCode = productOverride?.productCode || "SMS-Enhanced";

        // Resolve description template
        const template = customer.furtherDescriptionSMSIntl || "...";
        const billingCycle = getBillingCycle(billingMonth);
        const furtherDesc = resolveTemplate(template, {
          BillingCycle: billingCycle,
          SMSCount: whatsappCount.toLocaleString(),
          SMSRate: rate.toFixed(3),
        });

        results.push({
          service: "WHATSAPP",
          billableCount: whatsappCount,
          rate,
          totalCharge: whatsappCount * rate,
          description: productCode,
          furtherDescription: furtherDesc,
        });
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp billable:", error);
    }
  }

  // 3. Fetch Email from recon server
  const emailReconServer = customer.reconServers?.find(r => r.type === "EMAIL");
  if (emailReconServer) {
    try {
      const emailData = await fetchEmailReconSummary(emailReconServer, billingMonth);
      if (emailData.count > 0) {
        const rate = customer.rates?.EMAIL || 0.11;
        const productOverride = customer.serviceProductOverrides?.find(
          o => o.serviceType === "EMAIL"
        );
        const productCode = productOverride?.productCode || "Email-Blast";

        const template = customer.invoiceDescriptionTemplate || "";
        const billingCycle = getBillingCycle(billingMonth);
        const furtherDesc = resolveTemplate(template, {
          BillingCycle: billingCycle,
          EmailCount: emailData.count.toLocaleString(),
          EmailRate: rate.toFixed(2),
        });

        results.push({
          service: "EMAIL",
          billableCount: emailData.count,
          rate,
          totalCharge: emailData.count * rate,
          description: productCode,
          furtherDescription: furtherDesc,
        });
      }
    } catch (error) {
      console.error("Failed to fetch Email recon:", error);
    }
  }

  return results;
}
```

### 6.3 Convert to InvoiceLineItem[]

```typescript
import { InvoiceLineItem, ServiceType } from "@/types";

function toInvoiceLineItems(billableData: CowayBillableResult[]): InvoiceLineItem[] {
  return billableData.map(item => ({
    service: item.service as ServiceType,
    billableCount: item.billableCount,
    rate: item.rate,
    totalCharge: item.totalCharge,
    description: item.description,
  }));
}
```

### 6.4 Validation Checks

Before generating invoice:

1. **Customer exists and has AutoCount config:**
   - `autocountAccountBookId` is set
   - `autocountDebtorCode` is set

2. **No duplicate invoice:**
   - Query existing invoices for customerId + billingMonth
   - If exists, return error: "Invoice already exists for this period"

3. **Billing month format:**
   - Must be "YYYY-MM" format
   - Should not be future month (optional business rule)

4. **Has billable data:**
   - If all services return 0, warn user but allow generation

### 6.5 Invoice History

Use existing `InvoiceHistory` interface and repository:

```typescript
// Save before calling AutoCount API
const invoice: InvoiceHistory = {
  id: `inv-${Date.now()}`,
  customerId,
  customerName: customer.name,
  billingMonth,
  totalAmount,
  status: "GENERATED",
  createdAt: new Date().toISOString(),
  lineItems,
};

// Update after API call
if (syncResult.success) {
  await updateInvoice(id, { status: "SYNCED", autocountRefId: docNo });
} else {
  await updateInvoice(id, { status: "ERROR", syncError: errorMessage });
}
```

## 7. UI Changes

### 7.1 New Generate Invoice Page

**File:** `/app/billing/generate-invoice/page.tsx`

- Customer dropdown (pre-populated with Coway for v1)
- Billing month picker
- "Generate Invoice" button
- Results panel showing:
  - Status (SYNCED/ERROR)
  - AutoCount document number
  - Total amount
  - Line items summary
  - Error message if failed
- History table of past generations

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| Customer not found | Return 404 |
| Customer missing AutoCount config | Return 400 with specific error |
| Duplicate invoice exists | Return 409 Conflict |
| No billable data | Generate with 0 amount (allow) |
| AutoCount API fails | Save as ERROR, show message |
| Network error | Retry with backoff, then error |

## 9. File Changes

### New Files
- `/domain/services/cowayBillingService.ts` - Fetches billable data for Coway
- `/app/billing/generate-invoice/page.tsx` - UI page

### Modified Files
- `/app/api/invoices/generate/route.ts` - Extend OR create new endpoint

## 10. AutoCount Configuration Storage

This section documents where AutoCount credentials and configurations are stored.

### 10.1 Account Books Collection (autoCountAccountBooks)

**Collection Name:** `autoCountAccountBooks`

**MongoDB Schema:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique ID | "accbook_001" |
| `name` | string | Friendly name | "G-I Main Book" |
| `accountBookId` | string | AutoCount account book ID | "4013" |
| `keyId` | string | API Key-ID | "671f8a54-..." |
| `apiKey` | string | Secret API key | "••••••••" |
| `defaultCreditTerm` | string | Default payment terms | "Net 30 days" |
| `defaultSalesLocation` | string | Default location | "HQ" |
| `invoiceDescriptionTemplate` | string | Invoice description template | "SMS Billing - {BillingCycle}" |
| `furtherDescriptionTemplate` | string | Line item description template | "For {BillingCycle}..." |
| `createdAt` | string | Timestamp | "2026-03-16T10:00:00Z" |
| `updatedAt` | string | Timestamp | "2026-03-16T10:00:00Z" |

**Example Document:**

```json
{
  "id": "accbook_001",
  "name": "G-I Main Book",
  "accountBookId": "4013",
  "keyId": "671f8a54-xxxx-xxxx",
  "apiKey": "secret-key-xxxx",
  "defaultCreditTerm": "Net 30 days",
  "defaultSalesLocation": "HQ",
  "invoiceDescriptionTemplate": "Invoice for {BillingCycle}",
  "furtherDescriptionTemplate": "For {BillingCycle}, the total number of SMS messages sent via ECS Service was {SMSCount}, charged at RM {SMSRate} per message.",
  "createdAt": "2026-03-16T10:00:00Z",
  "updatedAt": "2026-03-16T10:00:00Z"
}
```

### 10.2 Service Product Mappings Collection (serviceProductMappings)

**Collection Name:** `serviceProductMappings`

**MongoDB Schema:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique ID | "mapping_001" |
| `accountBookId` | string | Links to AutoCount account book | "accbook_001" |
| `serviceType` | string | "SMS" \| "EMAIL" \| "WHATSAPP" | "SMS" |
| `productCode` | string | AutoCount product code | "SMS-Enhanced" |
| `description` | string | Optional description | "SMS Blast on ECS" |
| `defaultUnitPrice` | number | Default rate per message | 0.079 |
| `defaultBillingMode` | string | "ITEMIZED" or "LUMP_SUM" | "LUMP_SUM" |
| `createdAt` | string | Timestamp | "2026-03-16T10:00:00Z" |
| `updatedAt` | string | Timestamp | "2026-03-16T10:00:00Z" |

**Example Documents:**

```json
{
  "id": "mapping_001",
  "accountBookId": "accbook_001",
  "serviceType": "SMS",
  "productCode": "SMS-Enhanced",
  "description": "SMS Blast on ECS",
  "defaultUnitPrice": 0.079,
  "defaultBillingMode": "LUMP_SUM",
  "createdAt": "2026-03-16T10:00:00Z",
  "updatedAt": "2026-03-16T10:00:00Z"
}
```

```json
{
  "id": "mapping_002",
  "accountBookId": "accbook_001",
  "serviceType": "WHATSAPP",
  "productCode": "WA-API",
  "description": "WhatsApp API",
  "defaultUnitPrice": 0.079,
  "defaultBillingMode": "LUMP_SUM",
  "createdAt": "2026-03-16T10:00:00Z",
  "updatedAt": "2026-03-16T10:00:00Z"
}
```

```json
{
  "id": "mapping_003",
  "accountBookId": "accbook_001",
  "serviceType": "EMAIL",
  "productCode": "Email-Blast",
  "description": "Email Marketing",
  "defaultUnitPrice": 0.11,
  "defaultBillingMode": "LUMP_SUM",
  "createdAt": "2026-03-16T10:00:00Z",
  "updatedAt": "2026-03-16T10:00:00Z"
}
```

### 10.3 Customer Link to Account Book

Each customer document in MongoDB (`customers` collection) has these AutoCount-related fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `autocountAccountBookId` | string | Links customer to account book | "accbook_001" |
| `autocountDebtorCode` | string | Customer's debtor code in AutoCount | "300-C001" |
| `serviceProductOverrides` | array | Override product codes per service | See below |

**Service Product Overrides Example:**

```json
"serviceProductOverrides": [
  { "serviceType": "SMS", "productCode": "SMS-Coway", "billingMode": "LUMP_SUM" },
  { "serviceType": "WHATSAPP", "productCode": "WA-Coway", "billingMode": "LUMP_SUM" },
  { "serviceType": "EMAIL", "productCode": "Email-Coway", "billingMode": "LUMP_SUM" }
]
```

### 10.4 How to Get AutoCount Credentials

To obtain AutoCount API credentials:

1. Log in to **AutoCount Cloud Accounting**
2. Navigate to **Settings → API Access** (or similar)
3. Create new API credentials:
   - **Key-ID**: Generated automatically
   - **API Key**: Generated or entered manually
4. Note the **Account Book ID** from the URL or settings page
5. Enter these in the app's **AutoCount Settings** page (`/autocount-settings`)

## 11. Sample API Call - Coway (Malaysia) Sdn Bhd, March 2026

This section documents a sample API call for generating an invoice for Coway (Malaysia) Sdn Bhd for billing period March 2026.

### 11.1 Data Sources

| Source | Data | Value |
|--------|------|-------|
| **Coway API** | SMS count | 15,000 messages |
| **WhatsApp Recon** | WhatsApp count | 2,500 messages |
| **Email Recon** | Email count | 10,000 messages |
| **Customer Config** | SMS rate | RM 0.079 |
| **Customer Config** | WhatsApp rate | RM 0.079 |
| **Customer Config** | Email rate | RM 0.11 |
| **Billing Client** | Debtor Code | 300-C001 |
| **Billing Client** | Tax Entity | TIN:C12113374050 |
| **Billing Client** | Address | Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur |

### 11.2 Calculated Values

| Line Item | Qty | Rate | Total |
|-----------|-----|------|-------|
| SMS | 15,000 | 0.079 | RM 1,185.00 |
| WhatsApp | 2,500 | 0.079 | RM 197.50 |
| Email | 10,000 | 0.11 | RM 1,100.00 |
| **Total** | - | - | **RM 2,482.50** |

### 11.3 API Request

**Endpoint:**
```
POST https://accounting-api.autocountcloud.com/{accountBookId}/invoice
```

**Headers:**
```
Key-ID: {keyId}
API-Key: {apiKey}
Content-Type: application/json
```

**Request Body:**
```json
{
  "master": {
    "docNo": null,
    "docNoFormatName": null,
    "docDate": "2026-04-01",
    "taxDate": null,
    "debtorCode": "300-C001",
    "debtorName": "Coway (Malaysia) Sdn Bhd",
    "creditTerm": "Net 30 days",
    "salesLocation": "HQ",
    "salesAgent": "Olivia Yap",
    "email": null,
    "address": "Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur",
    "ref": null,
    "description": "Invoice for March 2026 - SMS, WhatsApp & Email Services",
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
      "description": "SMS-Enhanced - March 2026",
      "furtherDescription": "For March 2026, the total number of International SMS messages sent via ECS Service was 15,000, charged at RM 0.079 per message.",
      "qty": 1,
      "unit": "unit",
      "unitPrice": 1185.00,
      "discount": null,
      "taxCode": "SV-6",
      "taxAdjustment": 0,
      "localTaxAdjustment": 0,
      "tariffCode": null,
      "localTotalCost": 0,
      "classificationCode": "022"
    },
    {
      "productCode": "WA-API",
      "accNo": "500-0000",
      "description": "WhatsApp API - March 2026",
      "furtherDescription": "For March 2026, the total number of International SMS messages sent via ECS Service was 2,500, charged at RM 0.079 per message.",
      "qty": 1,
      "unit": "unit",
      "unitPrice": 197.50,
      "discount": null,
      "taxCode": "SV-6",
      "taxAdjustment": 0,
      "localTaxAdjustment": 0,
      "tariffCode": null,
      "localTotalCost": 0,
      "classificationCode": "022"
    },
    {
      "productCode": "Email-Blast",
      "accNo": "500-0000",
      "description": "Email Blast - March 2026",
      "furtherDescription": "For March 2026, the total number of Email sent was 10,000, charged at RM 0.11 per message.",
      "qty": 1,
      "unit": "unit",
      "unitPrice": 1100.00,
      "discount": null,
      "taxCode": "SV-6",
      "taxAdjustment": 0,
      "localTaxAdjustment": 0,
      "tariffCode": null,
      "localTotalCost": 0,
      "classificationCode": "022"
    }
  ],
  "autoFillOption": {
    "accNo": false,
    "taxCode": true,
    "tariffCode": false,
    "localTotalCost": true
  },
  "saveApprove": null
}
```

### 11.4 Key Notes

1. **docDate**: Set to first day of month following billing period (April 1, 2026 for March 2026 billing)
2. **Billing Mode**: Uses LUMP_SUM mode (qty=1, unitPrice=total) to avoid AutoCount 2dp rounding issues
3. **Product Codes**: Derived from customer config `serviceProductOverrides`
4. **Tax Code**: SV-6 (as configured for Coway in billing_clients)
5. **Description Templates**: Resolved from customer config templates

### 11.5 Expected Response

**Success (201 Created):**
```
Location: https://accounting-api.autocountcloud.com/{accountBookId}/invoice?docNo=I-000123
```

**Response Body:**
```json
{
  "success": true,
  "docNo": "I-000123"
}
```

**Error (400/500):**
```json
{
  "success": false,
  "error": "Error message from AutoCount"
}
```

## 12. Testing Mode (Mock Mode)

For development and testing purposes, the system supports a **Mock Mode** that simulates AutoCount API calls without actually creating invoices in AutoCount.

### 12.1 Environment Variable

Add to `.env.local`:

```
AUTOCOUNT_MOCK=true
```

### 12.2 Behavior

When `AUTOCOUNT_MOCK=true`:

1. **No actual API call** is made to AutoCount
2. **Payload is logged** to console for debugging
3. **Fake success response** is returned with a mock document number

### 12.3 Mock Response

```typescript
// Mock response returned
{
  success: true,
  docNo: "MOCK-XXXXXXXXX"
}
```

### 12.4 Console Output

When mock mode is enabled, the full payload is logged:

```
=== AUTOCOUNT INVOICE PAYLOAD ===
{
  "master": {
    "docNo": null,
    "docDate": "2026-04-01",
    ...
  },
  "details": [
    {
      "productCode": "SMS-Enhanced",
      ...
    }
  ]
}
```

### 12.5 How to Enable/Disable

| Environment | Value | Behavior |
|-------------|-------|----------|
| Development | `AUTOCOUNT_MOCK=true` | Mock mode enabled |
| Development | `AUTOCOUNT_MOCK=false` | Real API calls |
| Production | (not set) | Real API calls (default) |

### 12.6 Best Practices

1. **Always test with mock mode first** before enabling real API calls
2. **Review console logs** to verify payload structure
3. **Use mock mode in CI/CD** for automated tests
4. **Use test account book** in AutoCount for integration testing (if available)

## 13. Success Criteria

- [ ] User can select customer (Coway) and billing month
- [ ] System validates customer has AutoCount config
- [ ] System checks for duplicate invoices
- [ ] System fetches SMS, WhatsApp, Email data automatically
- [ ] System uses rates from customer config
- [ ] Invoice is created in AutoCount with correct data
- [ ] Invoice record is saved in MongoDB
- [ ] Clear error messages for failures
