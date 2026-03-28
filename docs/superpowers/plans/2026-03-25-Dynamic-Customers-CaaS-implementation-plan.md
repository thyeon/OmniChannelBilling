# Dynamic Customers CaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform billing app into a Configuration-as-a-Service platform where all AutoCount invoice fields are configurable per-customer via UI, with zero hardcoding.

**Architecture:** Extend existing models with new fields (backward-compatible). Create new `customerProductMappings` collection for per-customer per-line AutoCount product config. Add multi-line extraction to `DataSource` via `lineItemMappings[]`. Wire everything through a new `ConfigurationService` + `ConfigCache`.

**Tech Stack:** Next.js App Router API, MongoDB, TypeScript. No new frameworks.

---

## Backward Compatibility Rule

All existing functionality MUST remain working. This means:
- Existing data sources with `responseMapping` (single-line) continue to work unchanged
- Existing `AutoCountInvoiceBuilder` must NOT break — only extend field resolution chain
- Coway billing must continue to work exactly as before
- All new fields are **additive only** — no existing field types or names change

---

## File Map

### Models (all in `billing-app/src/domain/models/`)
- `autoCountAccountBook.ts` — extend with 5 new fields
- `dataSource.ts` — extend with `lineItemMappings[]`, `requestTemplate`, `retryPolicy`, `fallbackValues`, `authCredentials.headerName`
- `customerProductMapping.ts` — **NEW FILE** — new collection schema

### Repositories (all in `billing-app/src/infrastructure/db/`)
- `autoCountAccountBookRepository.ts` — add CRUD for new account book fields
- `dataSourceRepository.ts` — add new query methods (already exists: findActive, findById)
- `customerProductMappingRepository.ts` — **NEW FILE** — CRUD for new collection

### Services (all in `billing-app/src/domain/services/`)
- `autocountInvoiceBuilder.ts` — extend field resolution chain (detail fields)
- `billingService.ts` — extend to use `lineItemMappings[]` and multi-line extraction
- `configurationService.ts` — **NEW FILE** — central config loader with caching
- `credentialEncryptionService.ts` — **NEW FILE** — AES-256 encryption for authCredentials
- `lineItemProcessor.ts` — **NEW FILE** — multi-line extraction via `lineItemMappings[]`
- `rateResolver.ts` — **NEW FILE** — rate resolution chain (Section 3.5.3)
- `templateTokenResolver.ts` — **NEW FILE** — `{billingMonth}`, `{month}`, `{year}` injection
- `configCache.ts` — **NEW FILE** — in-memory cache with TTL

### API Routes
- `billing-app/src/app/api/autocount/account-books/route.ts` — existing, extend for new fields
- `billing-app/src/app/api/customers/[id]/datasources/route.ts` — existing, extend validation
- `billing-app/src/app/api/customers/[id]/datasources/[dsId]/route.ts` — existing, extend PATCH validation
- `billing-app/src/app/api/customer-product-mappings/route.ts` — **NEW FILE** — CRUD for customerProductMappings
- `billing-app/src/app/api/config/load/route.ts` — **NEW FILE** — load customer config
- `billing-app/src/app/api/config/invalidate/route.ts` — **NEW FILE** — invalidate cache

### UI Pages
- `billing-app/src/app/admin/settings/autocount/page.tsx` — extend with new account book fields
- `billing-app/src/app/admin/customers/wizard/DataSourceStep.tsx` — extend with lineItemMappings UI
- `billing-app/src/app/admin/customers/wizard/ProductMappingStep.tsx` — **NEW OR REDESIGNED** — per-customer product mapping

### Types
- `billing-app/src/types/index.ts` — add `Customer.status`, `Customer.billingCycle`, `Customer.defaultFields`

---

## Phase 1 Tasks: Account Book Schema Enhancement

### Task 1.1: Add 5 new fields to AutoCountAccountBook model

**Files:**
- Modify: `billing-app/src/domain/models/autoCountAccountBook.ts`
- Test: `billing-app/src/domain/models/__tests__/autoCountAccountBook.test.ts`

- [ ] **Step 1: Add test cases for new fields**

```typescript
// billing-app/src/domain/models/__tests__/autoCountAccountBook.test.ts
import { AutoCountAccountBook } from '../autoCountAccountBook';

describe('AutoCountAccountBook model', () => {
  it('should accept 5 new optional fields', () => {
    const book: AutoCountAccountBook = {
      id: 'acc-001',
      name: 'Test Book',
      accountBookId: 'AB-001',
      keyId: 'key-001',
      apiKey: 'test-api-key',
      defaultCreditTerm: 'Net 30',
      defaultSalesLocation: 'HQ',
      defaultTaxCode: 'SV-6',
      taxEntity: 'TIN:123',
      invoiceDescriptionTemplate: 'Monthly billing for {CustomerName}',
      furtherDescriptionTemplate: 'Billing period: {BillingCycle}',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // NEW FIELDS
      defaultSalesAgent: 'Olivia Yap',
      defaultAccNo: '500-0000',
      defaultClassificationCode: '022',
      inclusiveTax: false,
      submitEInvoice: false,
    };
    expect(book.defaultSalesAgent).toBe('Olivia Yap');
    expect(book.inclusiveTax).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** (missing fields)
- [ ] **Step 3: Add the 5 new fields to the interface in `autoCountAccountBook.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

```
git add billing-app/src/domain/models/autoCountAccountBook.ts billing-app/src/domain/models/__tests__/autoCountAccountBook.test.ts
git commit -m "feat(phase1): add 5 new fields to AutoCountAccountBook model

Adds defaultSalesAgent, defaultAccNo, defaultClassificationCode, inclusiveTax,
submitEInvoice fields for configurable AutoCount invoice header fields."
```

---

### Task 1.2: Add Customer.status, Customer.billingCycle, Customer.defaultFields

**Files:**
- Modify: `billing-app/src/types/index.ts`
- Test: `billing-app/src/types/__tests__/index.test.ts`

- [ ] **Step 1: Write test for new Customer fields**
- [ ] **Step 2: Add `status`, `billingCycle`, `defaultFields` to Customer interface**
- [ ] **Step 3: Run test to verify it passes**
- [ ] **Step 4: Commit**

```
git commit -m "feat(phase1): add status, billingCycle, defaultFields to Customer type"
```

---

### Task 1.3: Update AutoCountInvoiceBuilder to use new account book fields

**Files:**
- Modify: `billing-app/src/domain/services/autocountInvoiceBuilder.ts`

**Changes:**
- Replace hardcoded `salesAgent: "Olivia Yap"` → use `accountBook.defaultSalesAgent`
- Replace hardcoded `accNo: "500-0000"` → use `detail.accNo ?? accountBook.defaultAccNo`
- Replace hardcoded `classificationCode: "022"` → use `detail.classificationCode ?? accountBook.defaultClassificationCode`
- Replace hardcoded `inclusiveTax: false` → use `accountBook.inclusiveTax`
- Replace hardcoded `submitEInvoice: false` → use `accountBook.submitEInvoice`

- [ ] **Step 1: Read autocountInvoiceBuilder.ts to understand current hardcoded values**
- [ ] **Step 2: Replace hardcoded values with accountBook field resolution**
- [ ] **Step 3: Run existing tests to verify backward compat (Coway still works)**
- [ ] **Step 4: Commit**

```
git commit -m "feat(phase1): use accountBook config fields instead of hardcoded values

Replaces hardcoded salesAgent, accNo, classificationCode, inclusiveTax,
submitEInvoice with values from AutoCountAccountBook. Backward compatible —
existing accounts without new fields use undefined which preserves old behavior."
```

---

## Phase 2 Tasks: CustomerProductMappings Collection (BRANCH: afterChina)

**Note:** This phase creates a new branch `afterChina` from `main`. Execute AFTER Phase 1 is complete on current branch.

### Task 2.1: Create customerProductMapping model

**Files:**
- Create: `billing-app/src/domain/models/customerProductMapping.ts`
- Test: `billing-app/src/domain/models/__tests__/customerProductMapping.test.ts`

- [ ] **Step 1: Write the model interface per Section 3.4 of spec**
- [ ] **Step 2: Write tests**
- [ ] **Step 3: Commit**

### Task 2.2: Create customerProductMappingRepository

**Files:**
- Create: `billing-app/src/infrastructure/db/customerProductMappingRepository.ts`
- Test: `billing-app/src/infrastructure/db/__tests__/customerProductMappingRepository.test.ts`

- [ ] **Step 1: Implement CRUD: create, findByCustomerId, findById, update, delete**
- [ ] **Step 2: Add `findByCustomerIdAndServiceType` helper**
- [ ] **Step 3: Write tests**
- [ ] **Step 4: Commit**

### Task 2.3: Create customer-product-mappings API route

**Files:**
- Create: `billing-app/src/app/api/customer-product-mappings/route.ts`
- Test: `billing-app/src/app/api/customer-product-mappings/__tests__/route.test.ts`

- [ ] **Step 1: Implement GET/POST for listing and creating mappings**
- [ ] **Step 2: Implement PUT/DELETE**
- [ ] **Step 3: Write tests**
- [ ] **Step 4: Commit**

### Task 2.4: Create ProductMappingStep component (Wizard)

**Files:**
- Create: `billing-app/src/app/admin/customers/wizard/ProductMappingStep.tsx`
- Modify: `billing-app/src/app/admin/customers/wizard/page.tsx` (wire in new step)

- [ ] **Step 1: Create per-customer product mapping grid UI per Section 6.5 of spec**
- [ ] **Step 2: Wire to customer-product-mappings API**
- [ ] **Step 3: Test manually**
- [ ] **Step 4: Commit**

---

## Phase 3 Tasks: DataSource Multi-Line Enhancement

### Task 3.1: Extend DataSource model with new fields

**Files:**
- Modify: `billing-app/src/domain/models/dataSource.ts`
- Test: `billing-app/src/domain/models/__tests__/dataSource.test.ts`

- [ ] **Step 1: Add `lineItemMappings[]`, `requestTemplate`, `retryPolicy`, `fallbackValues` fields**
- [ ] **Step 2: Add `headerName` to `authCredentials`**
- [ ] **Step 3: Update tests**
- [ ] **Step 4: Commit**

### Task 3.2: Extend DataSource API route validation

**Files:**
- Modify: `billing-app/src/app/api/customers/[id]/datasources/route.ts`
- Modify: `billing-app/src/app/api/customers/[id]/datasources/[dsId]/route.ts`

- [ ] **Step 1: Update POST/PATCH validation to include new fields**
- [ ] **Step 2: Write integration tests**
- [ ] **Step 3: Commit**

### Task 3.3: Create LineItemProcessor service

**Files:**
- Create: `billing-app/src/domain/services/lineItemProcessor.ts`
- Create: `billing-app/src/domain/services/__tests__/lineItemProcessor.test.ts`

- [ ] **Step 1: Implement `processMultiLine` — iterate `lineItemMappings[]` and extract via countPath**
- [ ] **Step 2: Implement `processLegacySingleLine` — use existing `responseMapping` for backward compat**
- [ ] **Step 3: Write tests covering both paths**
- [ ] **Step 4: Commit**

### Task 3.4: Create TemplateTokenResolver utility

**Files:**
- Create: `billing-app/src/domain/services/templateTokenResolver.ts`
- Create: `billing-app/src/domain/services/__tests__/templateTokenResolver.test.ts`

- [ ] **Step 1: Implement token injection: `{billingMonth}`, `{month}`, `{year}` into URL (GET) or body (POST)**
- [ ] **Step 2: Write tests**
- [ ] **Step 3: Commit**

### Task 3.5: Create RateResolver service

**Files:**
- Create: `billing-app/src/domain/services/rateResolver.ts`
- Create: `billing-app/src/domain/services/__tests__/rateResolver.test.ts`

- [ ] **Step 1: Implement rate resolution chain per Section 3.5.3: ratePath → fallbackRate → customerProductMappings.defaultUnitPrice**
- [ ] **Step 2: Write tests covering all 3 resolution paths**
- [ ] **Step 3: Commit**

### Task 3.6: Extend CUSTOM_REST_API fetcher in BillingService

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts`
- Test: `billing-app/src/domain/services/__tests__/billingService.test.ts`

- [ ] **Step 1: Extend `fetchBillableForDataSource` to support POST method via `requestTemplate`**
- [ ] **Step 2: Add custom header support via `headerName`**
- [ ] **Step 3: Add retry logic via `retryPolicy`**
- [ ] **Step 4: Add fallback values via `fallbackValues`**
- [ ] **Step 5: Wire in `LineItemProcessor` for multi-line data sources**
- [ ] **Step 6: Ensure backward compat — existing `responseMapping` path unchanged**
- [ ] **Step 7: Write tests**
- [ ] **Step 8: Commit**

---

## Phase 4 Tasks: Configuration Service & Encryption

### Task 4.1: Create ConfigCache service

**Files:**
- Create: `billing-app/src/domain/services/configCache.ts`
- Test: `billing-app/src/domain/services/__tests__/configCache.test.ts`

- [ ] **Step 1: Implement in-memory cache with TTL (5 min for customer, 10 min for mappings)**
- [ ] **Step 2: Implement `invalidate(customerId)` to clear all entries for a customer**
- [ ] **Step 3: Write tests**
- [ ] **Step 4: Commit**

### Task 4.2: Create CredentialEncryptionService

**Files:**
- Create: `billing-app/src/domain/services/credentialEncryptionService.ts`
- Test: `billing-app/src/domain/services/__tests__/credentialEncryptionService.test.ts`

- [ ] **Step 1: Implement AES-256-GCM encryption/decryption using `CREDENTIAL_ENCRYPTION_KEY` env var**
- [ ] **Step 2: Never expose raw credentials in logs or API responses**
- [ ] **Step 3: Add `encrypt(plaintext)` and `decrypt(ciphertext)` functions**
- [ ] **Step 4: Write tests**
- [ ] **Step 5: Commit**

### Task 4.3: Create ConfigurationService

**Files:**
- Create: `billing-app/src/domain/services/configurationService.ts`
- Test: `billing-app/src/domain/services/__tests__/configurationService.test.ts`

- [ ] **Step 1: Implement `loadCustomerConfig(customerId)` — load from cache or DB**
- [ ] **Step 2: Implement `loadDataSources(customerId)` with encryption decryption**
- [ ] **Step 3: Implement `loadProductMappings(customerId)`**
- [ ] **Step 4: Wire in `ConfigCache`**
- [ ] **Step 5: Write tests**
- [ ] **Step 6: Commit**

### Task 4.4: Create config API routes

**Files:**
- Create: `billing-app/src/app/api/config/load/route.ts`
- Create: `billing-app/src/app/api/config/invalidate/route.ts`

- [ ] **Step 1: Implement GET /api/config/load?customerId=X**
- [ ] **Step 2: Implement POST /api/config/invalidate** (admin only)
- [ ] **Step 3: Write tests**
- [ ] **Step 4: Commit**

---

## Phase 5 Tasks: Status-Based Billing & Cycle Support

### Task 5.1: Add status check to BillingService

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts`
- Test: `billing-app/src/domain/services/__tests__/billingService.test.ts`

- [ ] **Step 1: At start of `generateBillableData`, check `customer.status`**
- [ ] **Step 2: If status !== 'ACTIVE', return empty lineItems with status info**
- [ ] **Step 3: Write tests for ACTIVE, SUSPENDED, MAINTENANCE cases**
- [ ] **Step 4: Commit**

### Task 5.2: Add billing cycle support

**Files:**
- Modify: `billing-app/src/domain/services/billingService.ts`
- Test: `billing-app/src/domain/services/__tests__/billingService.test.ts`

- [ ] **Step 1: Add `shouldBillThisMonth(customer, billingMonth)` helper**
- [ ] **Step 2: MONTHLY: always bill**
- [ ] **Step 3: QUARTERLY: bill if `(month - 1) % 3 === 0`**
- [ ] **Step 4: YEARLY: bill if `month === customer.billingStartMonth`** (default: 1)
- [ ] **Step 5: Write tests**
- [ ] **Step 6: Commit**

### Task 5.3: Final integration and backward compat verification

- [ ] **Step 1: Run full test suite — all existing tests must pass**
- [ ] **Step 2: Test that Coway billing still works end-to-end**
- [ ] **Step 3: Verify all new fields are optional (backward compat)**
- [ ] **Step 4: Commit final state**

---

## Task Summary

| # | Task | Phase | Branch | Deps |
|---|------|-------|--------|------|
| 1.1 | AutoCountAccountBook model — 5 new fields | 1 | current | — |
| 1.2 | Customer type — status, billingCycle, defaultFields | 1 | current | — |
| 1.3 | AutoCountInvoiceBuilder — use accountBook fields | 1 | current | 1.1 |
| 2.1 | customerProductMapping model | 2 | **afterChina** | 1.1, 1.2 |
| 2.2 | customerProductMappingRepository | 2 | **afterChina** | 2.1 |
| 2.3 | customer-product-mappings API route | 2 | **afterChina** | 2.2 |
| 2.4 | ProductMappingStep wizard component | 2 | **afterChina** | 2.3 |
| 3.1 | DataSource model — lineItemMappings etc. | 3 | current | 1.1 |
| 3.2 | DataSource API route validation | 3 | current | 3.1 |
| 3.3 | LineItemProcessor service | 3 | current | 3.1 |
| 3.4 | TemplateTokenResolver utility | 3 | current | 3.1 |
| 3.5 | RateResolver service | 3 | current | 3.3, 3.4 |
| 3.6 | BillingService — multi-line, POST, retry | 3 | current | 3.2, 3.3, 3.5 |
| 4.1 | ConfigCache service | 4 | current | 3.6 |
| 4.2 | CredentialEncryptionService | 4 | current | — |
| 4.3 | ConfigurationService | 4 | current | 4.1, 4.2, 3.6 |
| 4.4 | Config load/invalidate API routes | 4 | current | 4.3 |
| 5.1 | Status check in BillingService | 5 | current | 1.2, 3.6 |
| 5.2 | Billing cycle support | 5 | current | 5.1 |
| 5.3 | Final integration + backward compat verification | 5 | current | 5.2, 4.4 |

**Execution Order:**
- Phase 1 tasks (1.1, 1.2, 1.3) → sequential within phase, parallel subagents across tasks
- Phase 3 tasks (3.1–3.6) → can start after 1.1; run in parallel subagents
- Phase 4 tasks (4.1–4.4) → start after 3.6
- Phase 5 tasks (5.1–5.3) → start after 4.4
- Phase 2 tasks (2.1–2.4) → **separate branch `afterChina`**, start after Phase 1 complete
