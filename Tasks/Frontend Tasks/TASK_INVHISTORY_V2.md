# TASK: Enhanced Invoice History Detail View

## Objective
Redesign the Invoice History detail view to show the full context of how each invoice was generated — including per-service usage breakdown, connection statuses to Service Provider and Reconciliation Server, discrepancy comparison, override tracking, billing cycle context, and sync error details.

## Decisions
- **Connection status**: Simulated at invoice generation time (mock success/failure per recon server and provider)
- **Override tracking**: Captured when user forces provider count or manually edits billable count
- **Detail view**: Dedicated page at `/history/[id]` (not a dialog)
- **Sync errors**: Show specific error message for troubleshooting

---

## 1. Data Model Changes

### New: `InvoiceLineItem` (per-service snapshot frozen at generation time)

```typescript
export interface InvoiceLineItem {
  service: ServiceType;
  hasProvider: boolean;

  // Connection status (simulated at generation time)
  reconServerStatus: 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED';
  providerStatus: 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED';
  reconServerName: string;
  providerName: string;

  // Usage data snapshot
  reconTotal: number;
  reconDetails: { sent: number; failed: number; withheld: number };
  providerTotal: number;

  // Discrepancy
  discrepancyPercentage: number;
  isMismatch: boolean;
  thresholdUsed: number;

  // Billing decision
  billableCount: number;
  wasOverridden: boolean;
  overrideReason?: string; // e.g. "Forced provider count", "Manual edit"

  // Charge
  rate: number;
  totalCharge: number;
}
```

### Extended: `InvoiceHistory`

Add these fields to the existing interface:

```typescript
  billingMode: 'MANUAL' | 'AUTO_PILOT';
  billingSchedule?: number;
  lineItems: InvoiceLineItem[];
  generatedBy: 'MANUAL' | 'SCHEDULED';
  syncError?: string;
```

---

## 2. Detail Page: `/history/[id]`

Route: `src/app/history/[id]/page.tsx`

### Layout (top to bottom):

#### A. Header
- Back link to `/billing` (Invoice History tab)
- Page title: "Invoice #inv-001"
- Status badge

#### B. Invoice Summary Card (3-column grid)
| Invoice ID | Status | Billing Month |
| Created | AutoCount Ref | Triggered By |
| Billing Mode | Cycle Day | Threshold |

#### C. Service Breakdown (one card per service)
Each card contains:

**Two-column layout:**
- **Left: Recon Server** — server name, connection status indicator (green dot = SUCCESS, red dot = FAILED, grey dot = N/A), sent/failed/withheld counts, total
- **Right: Service Provider** — provider name, connection status indicator, total count. If `hasProvider === false`, show "Not Configured" with grey indicator. Full-width recon if no provider.

**Discrepancy alert:**
- Green "Verified" if matched
- Red "Discrepancy Detected" with percentage if mismatched
- Grey "Recon Only" if no provider

**Billing decision row:**
- Billable count (with override badge if `wasOverridden`)
- Rate per unit
- Line total charge

#### D. Footer
- Grand total (sum of all line items)
- If status === ERROR: show sync error message in a destructive Alert + Retry Sync button

---

## 3. Invoice History Table Updates

- "View" button changes from opening a dialog to navigating to `/history/[id]`
- Remove the existing View Details dialog
- Keep filter bar and table as-is

---

## 4. Generate Invoice Wiring

When "Generate Invoice" is clicked on the billing page:
1. For each service in `usageData`, simulate connection status:
   - Recon server: ~90% success rate mock
   - Provider: ~85% success rate mock (or NOT_CONFIGURED if no provider)
2. Capture current `forceProviderCount` state and any manual edits as `wasOverridden` / `overrideReason`
3. Snapshot the customer's `discrepancyThreshold`, `billingMode`, `billingSchedule`
4. Build `InvoiceLineItem[]` from the current `UsageData[]`
5. Create `InvoiceHistory` record with all fields populated
6. Simulate AutoCount sync (~80% success) — on failure, populate `syncError`

---

## 5. Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | Add `InvoiceLineItem` interface, extend `InvoiceHistory` | `src/types/index.ts` |
| 2 | Update mock invoice data with line items, connection statuses, billing context | `src/components/invoice-history.tsx`, `src/app/api/history/route.ts` |
| 3 | Create `/history/[id]` detail page | `src/app/history/[id]/page.tsx` |
| 4 | Update invoice-history table: View → navigate to `/history/[id]`, remove dialog | `src/components/invoice-history.tsx` |
| 5 | Wire Generate Invoice to produce full `InvoiceHistory` with `InvoiceLineItem[]` | `src/app/billing/page.tsx` |
| 6 | Verify build + visual check | — |

## Constraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.
