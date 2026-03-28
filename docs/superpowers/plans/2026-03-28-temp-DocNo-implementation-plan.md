# TempDocNo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a `ddmmyyhhmm`-format `tempDocNo` when "Generate Invoice" is clicked, store it on the invoice record, display it in the DocNo column, and replace it with the real AutoCount DocNo after successful submission.

**Architecture:** Add an explicit `tempDocNo` field to `InvoiceHistory`. Create a stateless `generateTempDocNo()` utility that produces a 12-char `ddmmyyhhmm` + 2-digit sequence string. Call it in the generic generate route when creating each invoice record. The existing `autocountRefId` field continues to hold the real DocNo post-submit.

**Tech Stack:** TypeScript, Next.js Route Handlers, React.

---

## File Map

| File | Role |
|------|------|
| `billing-app/src/types/index.ts:140-162` | Add `tempDocNo: string \| null` to `InvoiceHistory` |
| `billing-app/src/domain/utils/tempDocNo.ts` | **NEW** — `generateTempDocNo()` pure utility |
| `billing-app/src/app/api/invoices/generate/generic/route.ts` | Call `generateTempDocNo()` per invoice in both MOCK and non-MOCK branches |
| `billing-app/src/app/billing/generate/page.tsx:646` | Show `tempDocNo ?? autocountRefId ?? "-"` in DocNo column |

---

## Task 1: Add `tempDocNo` field to `InvoiceHistory` type

**Files:**
- Modify: `billing-app/src/types/index.ts:140-162`

- [ ] **Step 1: Add `tempDocNo` field to `InvoiceHistory`**

In `billing-app/src/types/index.ts`, find the `InvoiceHistory` interface (around line 140) and add `tempDocNo?: string | null;` after `autocountRefId`:

```typescript
export interface InvoiceHistory {
  id: string;
  customerId: string;
  customerName: string;
  billingMonth: string;
  totalAmount: number;
  status: InvoiceStatus;
  // Present only when status is SYNCED
  autocountRefId?: string;
  // Temp DocNo assigned at DRAFT creation (ddmmyyhhmm format)
  tempDocNo?: string | null;
  createdAt: string;
  // ... rest of fields unchanged
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/types/index.ts
git commit -m "feat: add tempDocNo field to InvoiceHistory"
```

---

## Task 2: Create `generateTempDocNo()` utility

**Files:**
- Create: `billing-app/src/domain/utils/tempDocNo.ts`

- [ ] **Step 1: Write the utility**

```typescript
let counter = 0;

/**
 * Generates a unique temporary DocNo in ddmmyyhhmm + 2-digit sequence format.
 * e.g., 280326143005 = 28 Mar 2026, 14:30, sequence 05.
 * Sequence wraps every 100 invoices per minute — acceptable for troubleshooting use case.
 */
export function generateTempDocNo(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const seq = String(counter++ % 100).padStart(2, '0');
  return `${dd}${mm}${yy}${hh}${min}${seq}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd billing-app && npx tsc --noEmit src/domain/utils/tempDocNo.ts
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/domain/utils/tempDocNo.ts
git commit -m "feat: add generateTempDocNo utility"
```

---

## Task 3: Assign `tempDocNo` in generic generate route

**Files:**
- Modify: `billing-app/src/app/api/invoices/generate/generic/route.ts`

There are two places where `InvoiceHistory` objects are created: the **MOCK_MODE** block (line 129) and the **non-MOCK** block (line 149). Both need `tempDocNo`.

- [ ] **Step 1: Import `generateTempDocNo`**

Add to the imports at the top of `billing-app/src/app/api/invoices/generate/generic/route.ts`:

```typescript
import { generateTempDocNo } from "@/domain/utils/tempDocNo";
```

- [ ] **Step 2: Add `tempDocNo` to MOCK_MODE invoice object (line 129)**

In the MOCK_MODE block, update the invoice object:

```typescript
const invoice: InvoiceHistory = {
  id: `inv-${Date.now()}`,
  customerId,
  customerName: customer.name,
  billingMonth,
  totalAmount,
  status: "DRAFT",
  tempDocNo: generateTempDocNo(),
  createdAt: new Date().toISOString(),
  billingMode: customer.billingMode,
  schedule: customer.schedule,
  generatedBy: "MANUAL",
  lineItems: groupItems,
  serviceId: primaryServiceId,
  projectName,
};
```

- [ ] **Step 3: Add `tempDocNo` to non-MOCK invoice object (line 149)**

In the non-MOCK block, update the invoice object the same way:

```typescript
const invoice: InvoiceHistory = {
  id: `inv-${Date.now()}`,
  customerId,
  customerName: customer.name,
  billingMonth,
  totalAmount,
  status: "DRAFT",
  tempDocNo: generateTempDocNo(),
  createdAt: new Date().toISOString(),
  billingMode: customer.billingMode,
  schedule: customer.schedule,
  generatedBy: "MANUAL",
  lineItems: groupItems,
  serviceId: primaryServiceId,
  projectName,
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd billing-app && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add billing-app/src/app/api/invoices/generate/generic/route.ts
git commit -m "feat: assign tempDocNo at invoice creation time"
```

---

## Task 4: Update DocNo column and result alert in generate page

**Files:**
- Modify: `billing-app/src/app/billing/generate/page.tsx`

- [ ] **Step 1: Update DocNo column cell (line 646)**

Find the DocNo column on line 646:

```tsx
<TableCell className="font-mono">{record.autocountRefId || "-"}</TableCell>
```

Replace with:

```tsx
<TableCell className="font-mono">{record.tempDocNo ?? record.autocountRefId ?? "-"}</TableCell>
```

- [ ] **Step 2: Update result alert to show `tempDocNo` (line 259)**

The success alert shows `docNo: invoices[0].autocountRefId` which is `null` at draft time. Change it to show `tempDocNo` so users see the identifier immediately after generation:

```tsx
docNo: invoices[0].tempDocNo ?? invoices[0].autocountRefId,
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/app/billing/generate/page.tsx
git commit -m "feat: show tempDocNo in DocNo column and result alert"
```

---

## Verification

After implementing all tasks:

1. **Start the dev server:** `cd billing-app && npm run dev`
2. **Open:** http://localhost:3001/billing/generate
3. **Select a customer and billing month, click "Generate Invoice"**
4. **Verify:** The Recent Invoices table shows a 12-char value (e.g., `280326143005` = `ddmmyyhhmm` + sequence `05`) in the DocNo column for the new DRAFT invoice. The result alert also shows this tempDocNo.
5. **Click the paper-plane Submit icon** on that invoice
6. **Verify:** After successful submit, the DocNo column updates to show the real AutoCount DocNo (e.g., `AC-2026-001234`).
