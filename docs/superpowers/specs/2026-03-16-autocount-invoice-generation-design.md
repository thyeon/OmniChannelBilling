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

## 10. Success Criteria

- [ ] User can select customer (Coway) and billing month
- [ ] System validates customer has AutoCount config
- [ ] System checks for duplicate invoices
- [ ] System fetches SMS, WhatsApp, Email data automatically
- [ ] System uses rates from customer config
- [ ] Invoice is created in AutoCount with correct data
- [ ] Invoice record is saved in MongoDB
- [ ] Clear error messages for failures
