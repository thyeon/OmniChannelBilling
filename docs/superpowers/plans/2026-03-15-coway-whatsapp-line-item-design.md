# Design: Add WhatsApp Line Item for Coway Billing Export

## Overview

Add a new WHATSAPP line item to the CSV export for client "Coway (Malaysia) Sdn Bhd". Similar to SMS implementation, call an API to fetch WhatsApp usage count, but:
- API credentials from WHATSAPP Recon Server in MongoDB (instead of env)
- serviceProvider: "ali" (instead of "gts")

## Requirements

1. **Data Source**: Call WhatsApp Recon Server API (same pattern as SMS Coway API)
2. **API Parameters**:
   - API endpoint, USER ID, API key: From WHATSAPP Recon Server in MongoDB
   - serviceProvider: "ali"
3. **Position**: Add WhatsApp line item after SMS line item in CSV export
4. **Rate**: Use rate from customer config (customerConfig.rates?.WHATSAPP)

## Architecture

### Components Affected

1. **billingExportService.ts** - Add WhatsApp fetch logic similar to SMS (cowayClient.ts pattern)
2. **cowayClient.ts** - May add new function or add WhatsApp logic here

### Data Flow

```
billingExportService.generatePreview()
  ├── fetchCowayBillable(period)         # Gets SMS count from Coway API
  │                                        # (serviceProvider: "gts")
  │
  └── NEW: fetchWhatsAppBillable()       # Gets WHATSAPP count
                                           # serviceProvider: "ali"
                                           # credentials from MongoDB WHATSAPP Recon Server
```

## Implementation Details

### Step 1: Create WhatsApp Fetch Function

Similar to SMS in cowayClient.ts, but:
- Get API endpoint, user, secret from WHATSAPP Recon Server in MongoDB
- Use serviceProvider: "ali" instead of "gts"
- Uses the **same period** as fetchCowayBillable(period)

```typescript
// In cowayClient.ts or new file
export async function fetchWhatsAppBillable(
  period: string,
  whatsappReconServer: ReconServer
): Promise<number> {
  // Uses the SAME getDateRange(period) as fetchCowayBillable
  const { dtFrom, dtTo } = getDateRange(period);

  const payload = {
    user: whatsappReconServer.userId,
    secret: whatsappReconServer.apiKey,
    serviceProvider: "ali",  // Different from SMS which uses "gts"
    dtFrom,
    dtTo,
  };

  const response = await fetch(whatsappReconServer.apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  const data = await response.json();
  return data.total || 0;
}
```

### Step 2: Add to billingExportService.ts

In the Coway section, after fetching SMS count:

```typescript
// Find WHATSAPP recon server from customer config
const whatsappReconServer = customerConfig.reconServers?.find(
  (r: ReconServer) => r.type === "WHATSAPP"
);

if (whatsappReconServer) {
  const whatsappCount = await fetchWhatsAppBillable(period, whatsappReconServer);
  if (whatsappCount > 0) {
    const whatsappRate = customerConfig.rates?.WHATSAPP || 0.079;
    const whatsappProductOverride = customerConfig.serviceProductOverrides?.find(
      (s: { serviceType: string; productCode: string }) => s.serviceType === "WHATSAPP"
    );
    const whatsappProductCode = whatsappProductOverride?.productCode || "SMS-Enhanced";

    // Add to line_items after SMS
    item.line_items.push({
      description: whatsappProductCode,
      description_detail: resolvedWhatsappDescription,
      qty: whatsappCount,
      unit_price: whatsappRate,
    });
  }
}
```

### Step 3: Line Item Order

Push WhatsApp to line_items array after SMS - the array order determines CSV order.

## Testing

1. Verify WhatsApp line item appears after SMS in preview
2. Verify correct count and rate applied
3. Verify CSV export includes WhatsApp line item
4. Verify API is called with serviceProvider: "ali"
5. Verify graceful handling when WHATSAPP recon server is not configured

## Files to Modify

1. `billing-app/src/infrastructure/external/cowayClient.ts` - Add fetchWhatsAppBillable function
2. `billing-app/src/domain/services/billingExportService.ts` - Call WhatsApp fetch and add line item
