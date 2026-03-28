# TempDocNo Feature Design

## Context

When "Generate Invoice" is invoked from `/billing/generate`, an invoice is created as `DRAFT` and stored in MongoDB. However, before the invoice is submitted to AutoCount (via the paper-plane "Submit" action), there is no unique, human-readable identifier for the invoice — only the MongoDB `_id`. Users need a temporary DocNo (`ddmmyyhhmm`) for troubleshooting in Claude Code sessions while the invoice is still in draft state.

---

## Goal

Generate a `ddmmyyhhmm` format DocNo when "Generate Invoice" is clicked. Store it as `tempDocNo` in the invoice record. Display it in the existing DocNo column of the Recent Invoices table. Replace it with the real AutoCount DocNo (`autocountRefId`) upon successful submission.

---

## Design

### 1. Data Model

Add `tempDocNo: string | null` to `InvoiceHistory`:

```typescript
// billing-app/src/types/index.ts
interface InvoiceHistory {
  // ... existing fields ...
  tempDocNo: string | null;   // NEW: ddmmyyhhmm format, set at DRAFT creation
  autocountRefId: string | null; // EXISTING: set only after AutoCount confirms
}
```

**Migration:** Existing invoices have `tempDocNo: null` — the DocNo column falls back to `autocountRefId` (existing behavior).

### 2. TempDocNo Generation Utility

New file: `billing-app/src/domain/utils/tempDocNo.ts`

```typescript
let counter = 0;

export function generateTempDocNo(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  // Counter ensures uniqueness within the same minute (max 100 per minute)
  const seq = String(counter++ % 100).padStart(2, '0');
  return `${dd}${mm}${yy}${hh}${min}${seq}`;
}
```

- Format: `ddmmyyhhmm` + 2-digit sequence = 12 characters total (e.g., `280326143005`)
- Counter resets per process lifetime — acceptable since the window is 1 minute
- No dependency on MongoDB or async calls — safe to call synchronously

### 3. Generic Generate API Changes

File: `billing-app/src/app/api/invoices/generate/generic/route.ts`

In the loop where invoice records are created (currently after `autocountInvoiceBuilder.buildAutoCountInvoice()`), assign a unique `tempDocNo` per invoice:

```typescript
const tempDocNo = generateTempDocNo();
// Save invoice with tempDocNo, status DRAFT
await invoiceRepository.create({
  tempDocNo,
  // ...other fields
});
```

For multi-invoice (INGLAB), each iteration of the loop generates its own `tempDocNo`.

### 4. Submit Route Changes

File: `billing-app/src/app/api/invoices/[id]/submit/route.ts`

The submit flow already extracts `docNo` from AutoCount and stores it as `autocountRefId`. The existing `docNo` field is returned to the caller — no changes needed here. The `tempDocNo` remains in the record (not overwritten).

### 5. UI: Recent Invoices DocNo Column

File: `billing-app/src/app/billing/generate/page.tsx`

The Recent Invoices table already has a DocNo column. It currently renders `autocountRefId ?? '-'`. Update to show `tempDocNo ?? autocountRefId ?? '-'`:

```tsx
// In the DocNo column cell:
<TableCell>{inv.tempDocNo ?? inv.autocountRefId ?? '-'}</TableCell>
```

After "Submit" succeeds, the React state should be updated so `autocountRefId` is now populated and displayed. This may already happen if the response refreshes the invoice list — verify the `onSubmitSuccess` callback updates local state.

### 6. Result Alert Display

After "Generate Invoice" is clicked, the success alert currently shows `autocountRefId` which is `null` at this point. Update to show `tempDocNo` instead (or in addition) for the draft-phase message.

### 7. History Page (Optional)

File: `billing-app/src/app/billing/history/page.tsx`

If the history table also has a DocNo column, apply the same fallback logic: `tempDocNo ?? autocountRefId ?? '-'`.

---

## Data Flow

```
[User clicks "Generate Invoice"]
    │
    ▼
POST /api/invoices/generate/generic
    │
    ├─► Generate tempDocNo via generateTempDocNo()
    ├─► Create invoice record: { tempDocNo, status: DRAFT }
    │
    ▼
[Recent Invoices table shows tempDocNo in DocNo column]
    │
    ▼
[User clicks paper-plane "Submit"]
    │
    ▼
POST /api/invoices/[id]/submit
    │
    ├─► AutoCount API returns real docNo
    ├─► Update invoice: { autocountRefId: <realDocNo>, status: SYNCED }
    │      (tempDocNo remains unchanged)
    │
    ▼
[Recent Invoices table shows autocountRefId in DocNo column]
```

---

## Files to Change

| File | Change |
|------|--------|
| `billing-app/src/types/index.ts` | Add `tempDocNo: string \| null` to `InvoiceHistory` |
| `billing-app/src/domain/utils/tempDocNo.ts` | **New file** — `generateTempDocNo()` |
| `billing-app/src/app/api/invoices/generate/generic/route.ts` | Call `generateTempDocNo()` per invoice, pass to repo create |
| `billing-app/src/app/billing/generate/page.tsx` | Show `tempDocNo ?? autocountRefId` in DocNo column |
| `billing-app/src/app/billing/history/page.tsx` | Same DocNo column fallback (if applicable) |

---

## Error Handling

- **Counter overflow (>99 invoices/min):** `% 100` wraps — theoretical risk for very high volume. Acceptable for troubleshooting use case. If needed, can fall back to random suffix.
- **Missing `tempDocNo` (old records):** `tempDocNo ?? autococuntRefId ?? '-'` gracefully falls back to existing behavior.
- **Submit failure:** `tempDocNo` remains in the record — user can still reference it for debugging.

---

## Out of Scope

- Retroactive backfill of `tempDocNo` for existing DRAFT invoices
- Unique constraint on `tempDocNo` (no two invoices will share one in normal flow)
- Changing how the real AutoCount DocNo is generated or stored
