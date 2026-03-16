# Coway (Malaysia) Sdn Bhd Billing Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Coway (Malaysia) Sdn Bhd to the billing export system at `/billing-export`, fetching data from Coway API (`https://sms2.g-i.com.my/api/summaryv2`) and MongoDB customer config, outputting to AutoCount CSV format with SV-6 tax code.

**Architecture:** Create a dedicated Coway client handler that fetches usage count from Coway API and customer configuration from MongoDB, merging data into a format compatible with the existing `generateCSV()` function. Add "SV-6" tax code support via BillingClient model extension.

**Tech Stack:** Next.js, TypeScript, MongoDB, External REST API

---

## File Structure

```
billing-app/src/
├── domain/
│   └── models/
│       └── billingClient.ts              [MODIFY - add optional tax_code field]
├── infrastructure/
│   ├── db/
│   │   └── billingClientRepository.ts    [MODIFY - add Coway seed data]
│   └── external/
│       ├── cowayClient.ts               [NEW - Coway API client]
│       └── inglabClient.ts              [EXISTING - for reference]
├── domain/
│   └── services/
│       └── billingExportService.ts      [MODIFY - add Coway support]
└── app/
    └── billing-export/
        └── page.tsx                     [MODIFY - add Coway to dropdown]
```

---

## Chunk 1: Data Model & Database

### Task 1: Add tax_code field to BillingClient model

**Files:**
- Modify: `billing-app/src/domain/models/billingClient.ts`

- [ ] **Step 1: Add tax_code field to BillingClient interface**

```typescript
export interface BillingClient {
  id?: string;
  source_client_name: string;
  debtor_code: string;
  tax_entity: string;
  address: string;
  tax_code?: string;  // Optional - defaults to "SV-8" if not specified
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/domain/models/billingClient.ts
git commit -m "feat: add optional tax_code field to BillingClient model"
```

---

### Task 2: Add Coway to billing clients seed data

**Files:**
- Modify: `billing-app/src/infrastructure/db/billingClientRepository.ts`

- [ ] **Step 1: Add Coway to seedBillingClients function**

Add this entry to the `defaultClients` array:

```typescript
{
  source_client_name: "Coway (Malaysia) Sdn Bhd",
  debtor_code: "300-C001",
  tax_entity: "TIN:C12113374050",
  address: "Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur",
  tax_code: "SV-6",  // Coway uses SV-6 instead of default SV-8
  is_active: true,
},
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/infrastructure/db/billingClientRepository.ts
git commit -m "feat: add Coway (Malaysia) Sdn Bhd to billing clients seed data"
```

---

## Chunk 2: Coway API Client

### Task 3: Create Coway API client

**Files:**
- Create: `billing-app/src/infrastructure/external/cowayClient.ts`

- [ ] **Step 1: Create cowayClient.ts**

```typescript
const COWAY_API_URL = process.env.COWAY_API_URL || "https://sms2.g-i.com.my/api/summaryv2";
const COWAY_API_SECRET = process.env.COWAY_API_SECRET || "VpHVSMLS1E4xa2vq7qtVYtb7XJIBDB";
const COWAY_API_USER = process.env.COWAY_API_USER || "gi_xHdw6";
const COWAY_SERVICE_PROVIDER = process.env.COWAY_SERVICE_PROVIDER || "gts";

export interface CowayApiResponse {
  success: boolean;
  total: number;
  successCount: number;
  failed: number;
  notReqToServiceProvider: number;
}

export interface CowayBillableItem {
  source_client_name: string;
  line_items: Array<{
    description: string;
    description_detail: string;
    qty: number;
    unit_price: number;
  }>;
}

/**
 * Convert period (YYYY-MM) to Malaysia timezone date range
 * @param period - Format: "2026-03"
 * @returns { dtFrom: string, dtTo: string } in Malaysia timezone (UTC+8)
 */
function getDateRange(period: string): { dtFrom: string; dtTo: string } {
  const [year, month] = period.split("-").map(Number);

  // Start of month: 1st day at 00:00:00 MYT (UTC+8)
  const dtFrom = `${year}-${String(month).padStart(2, "0")}-01 00:00:00`;

  // End of month: last day at 23:59:59 MYT (UTC+8)
  // Handle leap year for February
  const daysInMonth = new Date(year, month, 0).getDate();
  const dtTo = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")} 23:59:59`;

  return { dtFrom, dtTo };
}

/**
 * Fetch billable data for Coway from Coway API
 * @param period - Format: "2026-03"
 * @returns CowayBillableItem[]
 */
export async function fetchCowayBillable(period: string): Promise<CowayBillableItem[]> {
  const { dtFrom, dtTo } = getDateRange(period);

  const payload = {
    user: COWAY_API_USER,
    secret: COWAY_API_SECRET,
    serviceProvider: COWAY_SERVICE_PROVIDER,
    dtFrom,
    dtTo,
  };

  const response = await fetch(COWAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch Coway billable data: ${response.status} - ${error}`);
  }

  const data: CowayApiResponse = await response.json();

  if (!data.success) {
    throw new Error(`Coway API returned success: false`);
  }

  // Return as array with single item - the MongoDB config will be merged later
  // For now, return the raw total count; the service layer will merge with MongoDB config
  return [{
    source_client_name: "Coway (Malaysia) Sdn Bhd",
    line_items: [{
      description: "",  // Will be populated from MongoDB template
      description_detail: "",  // Will be populated from MongoDB template
      qty: data.total,
      unit_price: 0,  // Will be populated from MongoDB rates
    }],
  }];
}
```

- [ ] **Step 2: Add environment variables to .env.local**

```bash
# Coway API Configuration
COWAY_API_URL=https://sms2.g-i.com.my/api/summaryv2
COWAY_API_SECRET=VpHVSMLS1E4xa2vq7qtVYtb7XJIBDB
COWAY_API_USER=gi_xHdw6
COWAY_SERVICE_PROVIDER=gts
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/infrastructure/external/cowayClient.ts
git add billing-app/.env.local
git commit -m "feat: add Coway API client for fetching billable data"
```

---

## Chunk 3: Billing Export Service Integration

### Task 4: Modify billingExportService to support Coway

**Files:**
- Modify: `billing-app/src/domain/services/billingExportService.ts`

- [ ] **Step 1: Add Coway to SUPPORTED_CLIENTS**

```typescript
const SUPPORTED_CLIENTS = [
  "AIA Malaysia",
  "Zurich Malaysia",
  "FWD Takaful",
  "Prudential Malaysia",
  "Pizza Hut",
  "Coway (Malaysia) Sdn Bhd",  // Add this
];
```

- [ ] **Step 2: Import Coway client and customer repository**

```typescript
import { fetchCowayBillable } from "@/infrastructure/external/cowayClient";
import { findCustomerByName } from "@/infrastructure/db/customerRepository";
```

- [ ] **Step 3: Add function to fetch customer config from MongoDB**

Add this function after the existing imports:

```typescript
/** Fetch customer config from MongoDB for Coway */
async function getCowayCustomerConfig() {
  const customers = await findAllCustomers();
  return customers.find(c => c.name === "Coway (Malaysia) Sdn Bhd");
}

/** Resolve placeholders in template string */
function resolveTemplate(template: string, values: Record<string, string>): string {
  let resolved = template;
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return resolved;
}

/** Generate billing cycle string from period */
function getBillingCycle(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${monthNames[month - 1]} ${year}`;
}
```

- [ ] **Step 4: Modify generatePreview to handle Coway differently**

Replace the fetch logic in `generatePreview`:

```typescript
export async function generatePreview(
  period: string,
  clientName?: string
): Promise<PreviewResult> {
  const defaults = await getFieldDefaults();
  const clientMappings = await getClientMappings();

  let billableItems: IngLabBillableItem[] | null = null;

  // Check if Coway is selected
  if (clientName === "Coway (Malaysia) Sdn Bhd" ||
      (clientName === "all" && !clientName)) {
    // Fetch Coway-specific data
    const cowayItems = await fetchCowayBillable(period);

    // Get MongoDB customer config
    const customerConfig = await getCowayCustomerConfig();

    if (customerConfig && cowayItems.length > 0) {
      const item = cowayItems[0];
      const rate = customerConfig.rates?.SMS || 0.079;
      const productOverride = customerConfig.serviceProductOverrides?.find(
        s => s.serviceType === "SMS"
      );
      const productCode = productOverride?.productCode || "SMS-Enhanced";
      const template = customerConfig.furtherDescriptionTemplate || "";

      // Format values for placeholder resolution
      const billingCycle = getBillingCycle(period);
      const smsCount = item.line_items[0].qty.toLocaleString();
      const smsRate = rate.toFixed(3);

      const resolvedDescription = resolveTemplate(template, {
        BillingCycle: billingCycle,
        SMSCount: smsCount,
        SMSRate: smsRate,
      });

      // Override line item with MongoDB config
      item.line_items[0] = {
        description: productCode,
        description_detail: resolvedDescription,
        qty: item.line_items[0].qty,
        unit_price: rate,
      };
    }

    // Convert to compatible format
    billableItems = cowayItems as unknown as IngLabBillableItem[];
  } else {
    // Use INGLAB API for other clients
    billableItems = await fetchIngLabBillable(period);
  }

  // ... rest of existing logic remains the same
}
```

- [ ] **Step 5: Modify generateCSV to use tax_code from BillingClient**

Update the CSV generation to use tax_code from the client mapping:

```typescript
// In generateCSV, find the client mapping and use its tax_code
const clientMapping = clientMappings.get(row.debtor_code);
const taxCode = clientMapping?.tax_code || "SV-8";  // Default to SV-8

// Then in the values array, use taxCode instead of hardcoded "SV-8"
values.push(taxCode);  // TaxCode column
```

- [ ] **Step 6: Commit**

```bash
git add billing-app/src/domain/services/billingExportService.ts
git commit -m "feat: add Coway support to billing export service"
```

---

## Chunk 4: UI Integration

### Task 5: Add Coway to billing export page dropdown

**Files:**
- Modify: `billing-app/src/app/billing-export/page.tsx`

- [ ] **Step 1: Add Coway to SUPPORTED_CLIENTS in page.tsx**

```typescript
const SUPPORTED_CLIENTS = [
  "AIA Malaysia",
  "Zurich Malaysia",
  "FWD Takaful",
  "Prudential Malaysia",
  "Pizza Hut",
  "Coway (Malaysia) Sdn Bhd",  // Add this
];
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/app/billing-export/page.tsx
git commit -m "feat: add Coway to billing export dropdown"
```

---

## Chunk 5: Testing

### Task 6: Test the integration

- [ ] **Step 1: Start the development server**

```bash
cd billing-app && npm run dev
```

- [ ] **Step 2: Navigate to http://localhost:3000/billing-export**

- [ ] **Step 3: Select "Coway (Malaysia) Sdn Bhd" from the client dropdown**

- [ ] **Step 4: Select a period (e.g., 2026-03)**

- [ ] **Step 5: Click "Preview" and verify:**
  - Data loads successfully
  - CSV columns are correct with SV-6 tax code
  - DetailDescription shows resolved template with placeholders

- [ ] **Step 6: Click "Export CSV" and verify the downloaded file**

---

## Verification Checklist

- [ ] Coway appears in the client dropdown
- [ ] Preview shows correct data from Coway API
- [ ] CSV contains "SV-6" as TaxCode
- [ ] CSV contains correct DebtorCode "300-C001"
- [ ] CSV contains correct TaxEntity "TIN:C12113374050"
- [ ] CSV contains correct Address
- [ ] DetailDescription shows resolved placeholders (BillingCycle, SMSCount, SMSRate)
- [ ] Quantity matches API total
- [ ] LocalTotalCost = total × rate

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add tax_code field to BillingClient model | ⬜ |
| 2 | Add Coway to billing clients seed data | ⬜ |
| 3 | Create Coway API client | ⬜ |
| 4 | Modify billingExportService for Coway | ⬜ |
| 5 | Add Coway to UI dropdown | ⬜ |
| 6 | Test the integration | ⬜ |
