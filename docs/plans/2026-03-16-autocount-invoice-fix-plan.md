# AutoCount Invoice Submission Fix Plan

## Date: 2026-03-16

## Issues Identified

### 1. Address Field is Null

**Problem:** The `address` field in the AutoCount invoice payload is `null`.

**Root Cause:** The address is being fetched from `accountBook` which doesn't have address data.

**Current Data Flow:**
```
autocountInvoiceBuilder.ts
    │
    └─> accountBook.address → null
```

**Solution:** Fetch address from `BillingClient` using `debtorCode`.

**Source Data (BillingClient):**
| Client | debtor_code | address |
|--------|-------------|---------|
| Coway (Malaysia) Sdn Bhd | 300-C001 | Level 20, Ilham Tower, No. 8 Jalan Binjai 50450 Kuala Lumpur |

---

### 2. TaxCode Incorrect (SV-8 instead of SV-6)

**Problem:** TaxCode is being set to `"SV-8"` instead of `"SV-6"` for Coway invoices.

**Root Cause:** TaxCode is being fetched from `accountBook.defaultTaxCode` instead of per-product mapping.

**Current Data Flow:**
```
Line Item (SMS)
    │
    └─> accountBook.defaultTaxCode → "SV-8" (wrong!)
```

**Solution:** Add `taxCode` field to Product Mappings and fetch per line item.

**AutoCount Expected Format:**
| Field | Type | Example |
|-------|------|---------|
| TaxCode | String | `"SV-6"`, `"SV-8"`, `"SR"`, `"ZS"` |

**Current Product Mappings (from API):**
| Service | productCode | taxCode (missing) |
|---------|-------------|-------------------|
| SMS | SMS-Enhanced | (none) |
| EMAIL | Email-Blast | (none) |
| WHATSAPP | SMS-Enhanced | (none) |

---

### 3. Submit Status Not Updating to SYNCED

**Problem:** After submission, invoice status remains as "DRAFT" instead of changing to "SYNCED".

**Root Cause:** Mock mode incorrectly sets status to `"DRAFT"` instead of `"SYNCED"`.

**Status:** FIXED (in previous session)

---

## Implementation Plan

### Task 1: Fix Address Field

**Files to Modify:**
- `billing-app/src/domain/services/autocountInvoiceBuilder.ts`

**Steps:**
1. Import `findBillingClientByDebtorCode` from `@/infrastructure/db/billingClientRepository`
2. Fetch BillingClient using `debtorCode`
3. Use `billingClient.address` for the `address` field in invoice master

**Code Change:**
```typescript
// Fetch billing client for address
const billingClient = await findBillingClientByDebtorCode(debtorCode);

// Use address from BillingClient
address: billingClient?.address || null,
```

---

### Task 2: Fix TaxCode Field (Add to Product Mapping)

**Files to Modify:**

1. `billing-app/src/domain/models/serviceProductMapping.ts`
   - Add `taxCode?: string` field

2. `billing-app/src/app/autocount-settings/page.tsx`
   - Add taxCode input field in Product Mappings form

3. `billing-app/src/app/api/autocount/product-mappings/route.ts`
   - Handle `taxCode` in POST request

4. `billing-app/src/app/api/autocount/product-mappings/[id]/route.ts`
   - Handle `taxCode` in PATCH request

5. `billing-app/src/infrastructure/db/serviceProductMappingRepository.ts`
   - Add `taxCode` to queries

6. `billing-app/src/domain/services/autocountInvoiceBuilder.ts`
   - Fetch taxCode from product mapping instead of accountBook

**Code Change (autocountInvoiceBuilder.ts):**
```typescript
// Current (wrong):
taxCode: accountBook.defaultTaxCode || null,

// Fixed:
taxCode: mapping?.taxCode || accountBook.defaultTaxCode || null,
```

---

### Task 3: Update Existing Product Mappings

**Action Required:** Manually add taxCode to product mappings via `/autocount-settings`:

| Service | productCode | taxCode to Set |
|---------|-------------|----------------|
| SMS | SMS-Enhanced | SV-6 |
| EMAIL | Email-Blast | SV-6 |
| WHATSAPP | SMS-Enhanced | SV-6 |

---

## Data Flow After Fix

```
Invoice Submission
    │
    ├─> Customer
    │      └─> debtorCode: "300-C001"
    │
    ├─> BillingClient (by debtorCode)
    │      └─> address: "Level 20, Ilham Tower..."
    │
    ├─> AccountBook
    │      └─> defaultTaxCode: "SV-8" (fallback)
    │
    └─> For each Line Item:
           └─> ProductMapping (by accountBookId + serviceType)
                  ├─> productCode: "SMS-Enhanced"
                  └─> taxCode: "SV-6" ← from product mapping
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/domain/services/autocountInvoiceBuilder.ts` | Fetch address from BillingClient, taxCode from product mapping |
| `src/domain/models/serviceProductMapping.ts` | Add taxCode field |
| `src/app/autocount-settings/page.tsx` | Add taxCode input to UI |
| `src/app/api/autocount/product-mappings/route.ts` | Handle taxCode in POST |
| `src/app/api/autocount/product-mappings/[id]/route.ts` | Handle taxCode in PATCH |
| `src/infrastructure/db/serviceProductMappingRepository.ts` | Add taxCode to type definitions |
