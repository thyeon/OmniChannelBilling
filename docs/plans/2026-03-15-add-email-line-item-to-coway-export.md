# Plan: Add Email Line Item to Coway Export

**Date:** 2026-03-15
**Status:** Ready for Implementation

---

## Objective

Add a second line item to the Coway (M) Sdn Bhd billing export CSV for EMAIL service, in addition to the existing SMS line item.

---

## Requirements

| Field | Source | Value |
|-------|--------|-------|
| API Endpoint | customer.reconServers where type="EMAIL" | `http://128.199.165.110:8080/invoice/findSentCount` |
| ProductCode | customer.serviceProductOverrides where serviceType="EMAIL" | "Email-Blast" |
| UnitPrice | customer.rates.EMAIL | 0.11 |
| FurtherDescription | customer.invoiceDescriptionTemplate | "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message." |

---

## API Details

**Endpoint:** `POST http://128.199.165.110:8080/invoice/findSentCount`

**Headers:**
```
Content-Type: application/json
x-token: fGxqeS9pzR7duRBV7xpXSkFBPtQFKn
```

**Request Body:**
```json
{
  "month": 3,
  "year": 2026
}
```

**Response:**
```json
{
  "count": 133754
}
```

---

## Current Data (Already Configured in MongoDB)

The Coway customer already has all required configuration:

```json
{
  "name": "Coway (Malaysia) Sdn Bhd",
  "services": ["SMS", "EMAIL"],
  "reconServers": [
    {
      "name": "GI Email Server",
      "type": "EMAIL",
      "apiKey": "fGxqeS9pzR7duRBV7xpXSkFBPtQFKn",
      "apiEndpoint": "http://128.199.165.110:8080/invoice/findSentCount",
      "apiFormat": "EMAIL_RECON"
    }
  ],
  "rates": {
    "SMS": 0.079,
    "EMAIL": 0.11,
    "WHATSAPP": 0
  },
  "serviceProductOverrides": [
    { "serviceType": "SMS", "productCode": "SMS-Enhanced" },
    { "serviceType": "EMAIL", "productCode": "Email-Blast" }
  ],
  "invoiceDescriptionTemplate": "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message."
}
```

---

## Implementation Steps

### Step 1: Modify `billingExportService.ts`

In the `generatePreview` function, after the SMS line item is constructed (around line 213), add:

```typescript
// Fetch EMAIL data if EMAIL recon server is configured
const emailReconServer = customerConfig.reconServers?.find(
  (r: { type: string }) => r.type === "EMAIL"
);

if (emailReconServer) {
  try {
    const emailData = await fetchEmailReconSummary(emailReconServer, period);
    const emailRate = customerConfig.rates?.EMAIL || 0.11;
    const emailProductOverride = customerConfig.serviceProductOverrides?.find(
      (s: { serviceType: string }) => s.serviceType === "EMAIL"
    );
    const emailProductCode = emailProductOverride?.productCode || "Email-Blast";

    const billingCycle = getBillingCycle(period);
    const emailCount = emailData.count;
    const emailRateFormatted = emailRate.toFixed(2);

    const emailDescription = `For ${billingCycle}, the total number of Email sent was ${emailCount.toLocaleString()}, charged at RM ${emailRateFormatted} per message.`;

    // Add email line item
    item.line_items.push({
      description: emailProductCode,
      description_detail: emailDescription,
      qty: emailCount,
      unit_price: emailRate,
    });
  } catch (error) {
    console.error("Failed to fetch email data for Coway:", error);
  }
}
```

### Step 2: Import fetchEmailReconSummary

Ensure the import exists at the top of `billingExportService.ts`:

```typescript
import { fetchEmailReconSummary } from "@/infrastructure/external/reconClient";
```

---

## Expected Output

The export CSV will now have 2 rows for Coway:

| Description | Further Description | Qty | Unit Price | Total |
|-------------|---------------------|-----|------------|-------|
| SMS-Enhanced | For March 2026, the total number of SMS messages sent via ECS Service was 3,155,640, charged at RM 0.079 per message. | 3,155,640 | 0.079 | 249,295.56 |
| Email-Blast | For March 2026, the total number of Email sent was 133,754, charged at RM 0.11 per message. | 133,754 | 0.11 | 14,712.94 |

---

## Testing

1. Test preview API: `GET /api/billing/preview?period=2026-03&client=Coway (Malaysia) Sdn Bhd`
2. Verify 2 line items in response
3. Test export: `POST /api/billing/export` with same parameters
4. Verify CSV has 2 rows

---

## Files to Modify

- `billing-app/src/domain/services/billingExportService.ts`
