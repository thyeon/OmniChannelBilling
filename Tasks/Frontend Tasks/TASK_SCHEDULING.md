# TASK: Scheduled Invoice Generation

## Objective
Enable automatic, scheduled invoice generation per customer. The system pulls usage data from Service Provider and/or Reconciliation Server (based on each customer's settings) on a configured day+time each month, generates the invoice for the previous calendar month, syncs to AutoCount, and auto-retries on failure.

## Decisions

| # | Decision |
|---|----------|
| 1 | **Customer-level schedule** — one schedule per customer, all services pulled together |
| 2 | **Previous calendar month** — fires on Day X, pulls data for entire previous month |
| 3 | **Day + time** — user sets day (1-31) and time (HH:MM, 24h) |
| 4 | **Both UIs** — configure in Customer form, read-only overview on Billing page |
| 5 | **Auto-retry** — on failure, retry after configurable interval (minutes), up to max retries |
| 6 | **Full auto-pilot** — fires automatically, no human review |

---

## 1. Data Model Changes

### 1a. New `BillingSchedule` type (replaces old `billingSchedule?: number`)

```typescript
export interface BillingSchedule {
  dayOfMonth: number;          // 1-31
  time: string;                // "09:00" (24h)
  retryIntervalMinutes: number; // e.g. 30
  maxRetries: number;          // e.g. 3
}
```

### 1b. Update `Customer`

```typescript
export interface Customer {
  // ... existing fields ...
  billingMode: 'MANUAL' | 'AUTO_PILOT';
  schedule?: BillingSchedule;  // REPLACES billingSchedule?: number
  // ... rest unchanged ...
}
```

Migration: remove `billingSchedule?: number`, add `schedule?: BillingSchedule`. Update all seed data and references.

### 1c. New `ScheduledJob` interface

```typescript
export type ScheduleJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface ScheduledJob {
  id: string;
  customerId: string;
  customerName: string;
  billingMonth: string;           // "2023-12" (previous month being billed)
  scheduledAt: string;            // ISO datetime
  status: ScheduleJobStatus;
  retryCount: number;
  maxRetries: number;
  retryIntervalMinutes: number;
  nextRetryAt?: string;
  invoiceId?: string;             // links to InvoiceHistory once generated
  error?: string;
  completedAt?: string;
}
```

### 1d. Extend `InvoiceHistory`

Add optional link back:
```typescript
  scheduledJobId?: string;
```

---

## 2. UI Changes

### 2a. Customer Form — Enhanced Billing Settings

Replace current simple day input with full schedule config when Auto Pilot is ON:
- Day of Month (number, 1-31)
- Time (time input, HH:MM)
- Retry Interval (number, minutes)
- Max Retries (number)
- Info callout explaining: "Invoice will be generated on Day X at HH:MM for the previous calendar month."

Defaults when toggling ON: day=1, time="00:00", retryInterval=30, maxRetries=3.

### 2b. Billing Page — New "Schedules" tab

Third tab: `[ Generate Invoice ] [ Invoice History ] [ Schedules ]`

Contains two sections:

**Upcoming Schedules** (computed from AUTO_PILOT customers):
| Customer | Next Run | Billing For | Status |

**Recent Runs** (from ScheduledJob store):
| Customer | Ran At | Billing For | Status | Retries | Actions |

- Completed → "View" links to `/history/[invoiceId]`
- Failed → shows error, "Retry Now" button
- Retrying → shows retry count and next retry time

### 2c. Generate Invoice tab — Info banner

When selected customer is AUTO_PILOT, show info Alert:
> "This customer is on Auto Pilot. Invoices are generated automatically on Day X at HH:MM. You can still generate a manual invoice below."

Remove the disabled state on Generate Invoice button — allow manual override.

---

## 3. Scheduler Engine (Simulated)

### `useScheduleStore` (Zustand)
- `jobs: ScheduledJob[]`
- `addJob`, `updateJob`, `getJobsByCustomer`, `getUpcomingJobs`, `getRecentRuns`

### `useScheduler` hook
- On mount: compute upcoming jobs from all AUTO_PILOT customers
- `setInterval` every 60s: check if any PENDING job's `scheduledAt` <= now
- When job fires:
  1. Set status → RUNNING
  2. Simulate data fetch (reuse `generateMockUsageData`)
  3. Simulate connection statuses (~90% recon success, ~85% provider success)
  4. Build `InvoiceLineItem[]`, create `InvoiceHistory` with `generatedBy: 'SCHEDULED'`
  5. Simulate AutoCount sync (~80% success)
  6. On success: status → COMPLETED, link `invoiceId`
  7. On failure: if retryCount < maxRetries → RETRYING + schedule nextRetryAt; else → FAILED

---

## 4. Seed Data Migration

### Current → New mapping:
- `billingSchedule?: number` → `schedule?: BillingSchedule`
- Customers with `billingMode: 'MANUAL'` → `schedule: undefined` (no change needed)
- Customers with `billingMode: 'AUTO_PILOT'` and `billingSchedule: 15` → `schedule: { dayOfMonth: 15, time: "09:00", retryIntervalMinutes: 30, maxRetries: 3 }`

### Files to update:
- `src/types/index.ts` — type definition
- `src/components/data-seeder.tsx` — seed customers
- `src/app/customers/page.tsx` — form + createEmptyCustomer
- `src/app/billing/page.tsx` — references to billingSchedule
- `src/components/invoice-history.tsx` — mock invoice data referencing billingSchedule
- `src/app/history/[id]/page.tsx` — detail page referencing billingSchedule

---

## 5. Implementation Order

| # | Task | Files |
|---|------|-------|
| 1 | Update `Customer` type: add `BillingSchedule`, remove old `billingSchedule` | `types/index.ts` |
| 2 | Add `ScheduledJob`, `ScheduleJobStatus`, `scheduledJobId` to types | `types/index.ts` |
| 3 | Migrate seed data to new schedule shape | `data-seeder.tsx` |
| 4 | Update Customer form: enhanced schedule config UI | `customers/page.tsx` |
| 5 | Migrate mock invoice data + detail page references | `invoice-history.tsx`, `history/[id]/page.tsx` |
| 6 | Create `useScheduleStore` Zustand store | `store/useScheduleStore.ts` |
| 7 | Build Schedules tab on Billing page | `billing/page.tsx` |
| 8 | Update Generate Invoice tab: info banner, allow manual override | `billing/page.tsx` |
| 9 | Implement `useScheduler` hook (simulated timer-based runner) | `hooks/useScheduler.ts` |
| 10 | Wire scheduler into app shell | `layout.tsx` or billing page |
| 11 | Verify build + visual check | — |
