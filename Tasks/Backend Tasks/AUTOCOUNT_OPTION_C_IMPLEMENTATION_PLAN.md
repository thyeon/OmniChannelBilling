# AutoCount Integration — Option C Implementation Plan

## Objective

Implement a flexible AutoCount Cloud Accounting integration that supports:
- Multiple customers billing under different AutoCount account books
- Centralized credential management per account book
- Service-to-product-code mapping at the account book level
- Per-customer overrides for credit terms, sales locations, and product codes

This enables the Billing App to generate invoices in AutoCount for any customer, regardless of their account book configuration.

---

## Scope

### In Scope

1. **New Data Models**
   - `AutoCountAccountBook` entity and repository
   - `ServiceProductMapping` entity and repository
   - Extend `Customer` model with AutoCount-related fields

2. **Backend API Routes**
   - CRUD for AutoCount Account Books
   - CRUD for Service Product Mappings (per account book)
   - Customer edit/update to support AutoCount overrides

3. **Domain Services**
   - `autocountClient.ts` — AutoCount API client with invoice creation
   - `autocountInvoiceBuilder.ts` — Build invoice payload from customer + usage data

4. **UI Components**
   - AutoCount Settings page (manage account books + product mappings)
   - Customer form extension (add AutoCount override fields)

5. **Integration**
   - Replace mock `syncWithAutoCount()` in invoice generation route with real API call
   - Store `autocountRefId` in invoice records

### Out of Scope

- AutoCount debtor management (creating/debtors via API)
- AutoCount product management (creating products via API)
- Invoice update/delete via AutoCount API
- Payment processing via AutoCount
- Tax code management (using `null` for now)
- Multi-currency support (assuming MYR for now)
- Invoice approval workflows in AutoCount

---

## Functional Requirements

### FR-1: AutoCount Account Book Management

| ID | Requirement |
|---|---|
| FR-1.1 | System SHALL allow creation of AutoCount Account Book records with: name, accountBookId, keyId, apiKey, defaultCreditTerm, defaultSalesLocation |
| FR-1.2 | System SHALL allow updating and deleting AutoCount Account Book records |
| FR-1.3 | System SHALL validate that `accountBookId`, `keyId`, and `apiKey` are non-empty and valid format |
| FR-1.4 | System SHALL list all AutoCount Account Books with basic info (id, name, accountBookId) |
| FR-1.5 | System SHALL allow fetching a single AutoCount Account Book with full details |

### FR-2: Service Product Mapping Management

| ID | Requirement |
|---|---|
| FR-2.1 | System SHALL allow creating Service Product Mappings linked to an AutoCount Account Book |
| FR-2.2 | Each mapping SHALL include: accountBookId, serviceType (SMS/EMAIL/WHATSAPP), productCode, optional description, optional defaultUnitPrice |
| FR-2.3 | System SHALL allow updating and deleting Service Product Mappings |
| FR-2.4 | System SHALL allow fetching all mappings for a specific account book |
| FR-2.5 | System SHALL validate that `productCode` exists in the linked AutoCount account book (via API call) |
| FR-2.6 | System SHALL ensure unique (accountBookId, serviceType) combinations (no duplicate mappings) |

### FR-3: Customer AutoCount Configuration

| ID | Requirement |
|---|---|
| FR-3.1 | Customer SHALL have optional fields: `autocountAccountBookId`, `autocountDebtorCode`, `creditTermOverride`, `salesLocationOverride`, `serviceProductOverrides` |
| FR-3.2 | `autocountDebtorCode` SHALL be required if `autocountAccountBookId` is set |
| FR-3.3 | `serviceProductOverrides` SHALL be an array of `{ serviceType, productCode }` for customer-specific product overrides |
| FR-3.4 | System SHALL allow customers without AutoCount configuration (non-billed customers) |
| FR-3.5 | Customer form SHALL include AutoCount configuration section (collapsible or separate tab) |

### FR-4: Invoice Generation with AutoCount Sync

| ID | Requirement |
|---|---|
| FR-4.1 | When generating an invoice, system SHALL fetch the customer's AutoCount configuration |
| FR-4.2 | System SHALL resolve credit term: customer override → account book default → error |
| FR-4.3 | System SHALL resolve sales location: customer override → account book default → error |
| FR-4.4 | System SHALL resolve product code per service: customer override → account book mapping → error |
| FR-4.5 | System SHALL build AutoCount invoice payload with resolved values |
| FR-4.6 | System SHALL POST invoice to AutoCount API using account book credentials |
| FR-4.7 | On success, system SHALL store `autocountRefId` (docNo) in the invoice record |
| FR-4.8 | On failure, system SHALL update invoice status to `ERROR` with sync error message |
| FR-4.9 | System SHALL log full request/response for debugging (credentials redacted) |

### FR-5: AutoCount API Client

| ID | Requirement |
|---|---|
| FR-5.1 | Client SHALL support creating invoices via POST to `/{accountBookId}/invoice` |
| FR-5.2 | Client SHALL use provided `Key-ID` and `API-Key` headers |
| FR-5.3 | Client SHALL handle rate limiting (retry with exponential backoff) |
| FR-5.4 | Client SHALL return structured error responses (status code + message) |
| FR-5.5 | Client SHALL validate required fields before sending request |

### FR-6: Data Migration

| ID | Requirement |
|---|---|
| FR-6.1 | System SHALL provide a migration script to create default AutoCount Account Book with existing credentials |
| FR-6.2 | System SHALL provide a migration script to create default Service Product Mappings for SMS service |
| FR-6.3 | Existing customers SHALL be linked to the default account book if they have `autocountCustomerId` |
| FR-6.4 | Migration SHALL be idempotent (safe to run multiple times) |

---

## Non-Functional Requirements

### NFR-1: Security

| ID | Requirement |
|---|---|
| NFR-1.1 | AutoCount API keys SHALL be stored encrypted in MongoDB |
| NFR-1.2 | API keys SHALL NOT be exposed in logs or API responses |
| NFR-1.3 | AutoCount configuration routes SHALL require authentication |
| NFR-1.4 | Admin-only access for AutoCount Settings page (manage account books) |

### NFR-2: Performance

| ID | Requirement |
|---|---|
| NFR-2.1 | Invoice generation with AutoCount sync SHALL complete within 5 seconds (including API call) |
| NFR-2.2 | AutoCount API client SHALL implement timeout (30s) and retry logic (3 attempts) |
| NFR-2.3 | Database queries for account book and product mappings SHALL be indexed |

### NFR-3: Reliability

| ID | Requirement |
|---|---|
| NFR-3.1 | If AutoCount API is unavailable, invoice SHALL be saved with `ERROR` status (not lost) |
| NFR-3.2 | Failed sync SHALL be retryable via UI button |
| NFR-3.3 | System SHALL log all AutoCount API calls for audit trail |
| NFR-3.4 | Rate limit errors (429) SHALL trigger automatic retry with backoff |

### NFR-4: Maintainability

| ID | Requirement |
|---|---|
| NFR-4.1 | AutoCount credentials SHALL be configurable via environment variables (development) |
| NFR-4.2 | Service product mappings SHALL be editable via UI (no code changes needed) |
| NFR-4.3 | Clear separation between domain logic and external API client |
| NFR-4.4 | Comprehensive unit tests for invoice builder and API client |

### NFR-5: Scalability

| ID | Requirement |
|---|---|
| NFR-5.1 | Design SHALL support multiple account books (no hard-coded limits) |
| NFR-5.2 | Design SHALL support adding new service types without code changes |
| NFR-5.3 | Database schema SHALL allow future extensions (e.g., multiple debtors per customer) |

---

## Constraints

### Technical Constraints

| ID | Constraint |
|---|---|
| TC-1 | AutoCount API has rate limiting (~100 requests/minute) |
| TC-2 | AutoCount API returns 403 for some endpoints (location, account listing) — cannot query these |
| TC-3 | AutoCount `accountBookId` in URL is numeric only (e.g., `4013`, not `AM00004013`) |
| TC-4 | Product codes must exist in AutoCount before use — cannot create via API |
| TC-5 | AutoCount API does not support `listing-simple` for invoices (404) |
| TC-6 | Cannot query sales locations or account numbers via API — must be configured manually |

### Business Constraints

| ID | Constraint |
|---|---|
| BC-1 | Each customer can only be linked to ONE AutoCount account book |
| BC-2 | A customer without AutoCount configuration cannot generate invoices |
| BC-3 | Product codes are account book-specific — same service may have different codes across books |
| BC-4 | Credit terms and sales locations must match valid values in AutoCount (validation via API not possible) |
| BC-5 | Invoice doc numbers are auto-generated by AutoCount — cannot be manually assigned |

### Data Constraints

| ID | Constraint |
|---|---|
| DC-1 | `autocountDebtorCode` must match an existing debtor in the linked account book |
| DC-2 | `productCode` in mappings must exist in the linked account book (validated via API) |
| DC-3 | `creditTerm` and `salesLocation` values cannot be validated via API — trust admin input |
| DC-4 | `serviceType` values limited to: `SMS`, `EMAIL`, `WHATSAPP` (extensible) |

---

## Questions (To Be Answered)

| ID | Question | Impact |
|---|---|---|
| Q-1 | Should AutoCount credentials be encrypted at rest in MongoDB? If yes, what encryption scheme? | Security implementation |
| Q-2 | Should there be a "Test Connection" button when creating/editing account books? | UX, validation |
| Q-3 | How should we handle customers who were previously configured with `autocountCustomerId` but no account book? | Migration strategy |
| Q-4 | Should the AutoCount Settings page be admin-only, or accessible to all authenticated users? | Access control |
| Q-5 | What happens if a customer's `autocountDebtorCode` is deleted in AutoCount? | Error handling |
| Q-6 | Should we implement a "Sync All Failed Invoices" batch job? | Operational feature |
| Q-7 | How should we handle rate limiting errors during bulk invoice generation? | Error handling |
| Q-8 | Should we support multiple debtors per customer in the future? | Schema design |

---

## Acceptance Criteria

### AC-1: AutoCount Account Book CRUD

- [ ] Admin can create a new AutoCount Account Book with all required fields
- [ ] Admin can view list of all account books with id, name, accountBookId
- [ ] Admin can edit an existing account book (all fields)
- [ ] Admin can delete an account book (with confirmation if customers are linked)
- [ ] System validates non-empty `accountBookId`, `keyId`, `apiKey` on save
- [ ] System prevents deletion if customers are linked (shows warning with customer count)

### AC-2: Service Product Mapping CRUD

- [ ] Admin can create a product mapping for an account book
- [ ] Admin can view all mappings for a specific account book
- [ ] Admin can edit and delete mappings
- [ ] System validates unique (accountBookId, serviceType) combinations
- [ ] System validates `productCode` exists in AutoCount via API call (optional, may defer)
- [ ] UI shows dropdown for `serviceType` (SMS, EMAIL, WHATSAPP)

### AC-3: Customer AutoCount Configuration

- [ ] Customer form includes AutoCount configuration section
- [ ] User can select account book from dropdown (populated from existing books)
- [ ] User can enter `autocountDebtorCode` (required if account book selected)
- [ ] User can optionally override `creditTerm` and `salesLocation`
- [ ] User can add product overrides per service (optional)
- [ ] System saves configuration to MongoDB
- [ ] System allows removing AutoCount configuration from a customer

### AC-4: Invoice Generation with AutoCount Sync

- [ ] When generating invoice for customer with AutoCount config:
  - [ ] System fetches account book credentials
  - [ ] System resolves credit term (override → default → error)
  - [ ] System resolves sales location (override → default → error)
  - [ ] System resolves product codes per service (override → mapping → error)
  - [ ] System builds invoice payload with correct structure
- [ ] System POSTs invoice to AutoCount API
- [ ] On success (201), invoice status updates to `SYNCED` with `autocountRefId`
- [ ] On failure (non-2xx), invoice status updates to `ERROR` with error message
- [ ] System logs full request/response (credentials redacted)
- [ ] System handles rate limiting with retry (3 attempts, exponential backoff)

### AC-5: Error Handling & Retry

- [ ] Failed invoice sync shows "Retry Sync" button in UI
- [ ] Clicking "Retry" re-attempts AutoCount API call
- [ ] Retry button is disabled for successfully synced invoices
- [ ] System shows clear error messages for common failures:
  - "Customer not configured for AutoCount billing"
  - "Missing product mapping for SMS service"
  - "AutoCount API unavailable (503)"
  - "Rate limit exceeded (429)"

### AC-6: Data Migration

- [ ] Migration script creates default AutoCount Account Book with existing credentials
- [ ] Migration script creates default Service Product Mapping for SMS → SMS-Enhanced
- [ ] Migration links existing customers with `autocountCustomerId` to default account book
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Migration logs actions taken

### AC-7: UI/UX

- [ ] AutoCount Settings page is accessible from main navigation
- [ ] Settings page has two tabs: "Account Books" and "Product Mappings"
- [ ] Account Books table shows: id, name, accountBookId, customer count, actions
- [ ] Product Mappings table shows: account book name, service type, product code, actions
- [ ] Customer form AutoCount section is collapsible (default collapsed)
- [ ] Form shows helpful tooltips for each field
- [ ] Loading states shown during API calls (e.g., "Testing connection...", "Syncing to AutoCount...")

### AC-8: Security

- [ ] AutoCount Settings page requires admin role
- [ ] API keys are stored encrypted in MongoDB
- [ ] API keys are never exposed in API responses or logs
- [ ] Only authenticated users can access AutoCount configuration routes

---

## UI/UX Expectations

### AutoCount Settings Page

**Layout:**
- Two tabs: "Account Books" and "Product Mappings"
- Clean table layout with action buttons (Edit, Delete)

**Account Books Tab:**
| Columns | Description |
|---|---|
| Name | Account book display name |
| Account Book ID | AutoCount numeric ID (e.g., 4013) |
| Customers | Count of linked customers |
| Actions | Edit, Delete (disabled if customers linked) |

**Add/Edit Account Book Modal:**
| Field | Type | Required | Placeholder |
|---|---|---|---|
| Name | Text | Yes | "G-I Main Book" |
| Account Book ID | Text | Yes | "4013" |
| Key-ID | Text | Yes | "671f8a54-..." |
| API Key | Password | Yes | •••••••• |
| Default Credit Term | Select | Yes | "Net 30 days", "C.O.D.", etc. |
| Default Sales Location | Text | Yes | "HQ" |

**Actions:**
- "Test Connection" button (validates credentials via API)
- "Save" button
- "Cancel" button

**Product Mappings Tab:**
| Columns | Description |
|---|---|
| Account Book | Dropdown to filter |
| Service Type | SMS / EMAIL / WHATSAPP |
| Product Code | Text input |
| Actions | Edit, Delete |

**Add/Edit Product Mapping Modal:**
| Field | Type | Required |
|---|---|---|
| Account Book | Select | Yes |
| Service Type | Select | Yes |
| Product Code | Text | Yes |
| Default Unit Price | Number | No |

### Customer Form Extension

**AutoCount Configuration Section (Collapsible):**

| Field | Type | Required | Description |
|---|---|---|---|
| Enable AutoCount Billing | Toggle | No | If off, customer is non-billed |
| Account Book | Select | Yes (if enabled) | Dropdown from existing books |
| Debtor Code | Text | Yes (if enabled) | e.g., "300-C001" |
| Credit Term Override | Text | No | Overrides default if set |
| Sales Location Override | Text | No | Overrides default if set |
| Product Overrides | Dynamic List | No | Add/remove per-service overrides |

**Product Overrides Row:**
| Field | Type |
|---|---|
| Service Type | Select (SMS, EMAIL, WHATSAPP) |
| Product Code | Text |

**Validation:**
- If "Enable AutoCount Billing" is on, "Account Book" and "Debtor Code" are required
- Show error if product code is empty for a service override

### Invoice History Page

**New Column:** "AutoCount Status"

| Status | Visual | Action |
|---|---|---|
| SYNCED | Green checkmark | View AutoCount invoice (link) |
| ERROR | Red exclamation | "Retry Sync" button |
| GENERATED (pending) | Gray clock | (no action) |

**Retry Sync Button:**
- Only visible for ERROR status
- Shows loading state during retry
- On success, updates status to SYNCED
- On failure, shows error toast

---

## Implementation Phases

### Phase 1: Data Model & Repositories (Week 1)

1. Create `AutoCountAccountBook` entity
2. Create `ServiceProductMapping` entity
3. Extend `Customer` model with AutoCount fields
4. Create repositories for `AutoCountAccountBook` and `ServiceProductMapping`
5. Update `Customer` repository to handle new fields
6. Write unit tests for repositories

### Phase 2: AutoCount API Client (Week 1)

1. Create `autocountClient.ts` with invoice creation method
2. Implement retry logic for rate limiting
3. Implement error handling and logging
4. Write unit tests for client

### Phase 3: Backend API Routes (Week 2)

1. `/api/autocount/account-books` (GET, POST, PUT, DELETE)
2. `/api/autocount/product-mappings` (GET, POST, PUT, DELETE)
3. `/api/autocount/test-connection` (POST — validate credentials)
4. Update `/api/customers/[id]/route.ts` to handle AutoCount fields
5. Write integration tests

### Phase 4: Invoice Generation Integration (Week 2)

1. Create `autocountInvoiceBuilder.ts` (build payload from customer + usage)
2. Update `/api/invoices/generate/route.ts` to call AutoCount client
3. Implement status update logic (SYNCED, ERROR)
4. Add retry endpoint `/api/invoices/[id]/retry-sync`
5. Write end-to-end tests

### Phase 5: UI Components (Week 3)

1. Create AutoCount Settings page
2. Extend Customer form with AutoCount section
3. Add "Retry Sync" button to Invoice History
4. Add loading states and error handling
5. Write component tests

### Phase 6: Migration & Deployment (Week 3)

1. Create migration script for default account book and mappings
2. Create migration script to link existing customers
3. Update environment variables documentation
4. Deploy to staging and test
5. Deploy to production

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AutoCount API changes/breaks | Low | High | Version-specific client, monitor for changes |
| Rate limiting blocks bulk operations | Medium | Medium | Implement queue-based processing for bulk |
| Product codes don't exist in AutoCount | Medium | High | Validate via API on save (optional) |
| Credentials leaked in logs | Low | Critical | Redaction logic, audit logging |
| Migration breaks existing data | Low | High | Idempotent migration, backup before run |
| UI complexity overwhelms users | Medium | Medium | Clear UX, tooltips, documentation |

---

## Dependencies

| Dependency | Status |
|---|---|
| AutoCount API documentation | ✅ Available |
| AutoCount API credentials | ✅ Provided |
| MongoDB schema design | ⏳ In progress |
| UI component library (shadcn/ui) | ✅ Available |
| Testing framework | ✅ Available |

---

## Success Metrics

| Metric | Target |
|---|---|
| Invoice sync success rate | >95% |
| Invoice sync latency | <5 seconds |
| UI page load time | <2 seconds |
| Test coverage | >80% |
| Migration time | <1 minute |
| Zero data loss during migration | 100% |

---

## Appendix: Data Model Schema

### AutoCountAccountBook

```typescript
{
  id: string                    // MongoDB ObjectId
  name: string                  // e.g., "G-I Main Book"
  accountBookId: string         // e.g., "4013"
  keyId: string                 // AutoCount Key-ID
  apiKey: string                // AutoCount API Key (encrypted)
  defaultCreditTerm: string     // e.g., "Net 30 days"
  defaultSalesLocation: string  // e.g., "HQ"
  createdAt: ISODate
  updatedAt: ISODate
}
```

### ServiceProductMapping

```typescript
{
  id: string                    // MongoDB ObjectId
  accountBookId: string         // FK → AutoCountAccountBook.id
  serviceType: string           // "SMS" | "EMAIL" | "WHATSAPP"
  productCode: string           // e.g., "SMS-Enhanced"
  description?: string         // Optional line description
  defaultUnitPrice?: number     // Optional default rate
  createdAt: ISODate
  updatedAt: ISODate
}
```

### Customer (Extended)

```typescript
{
  ...existing fields...
  autocountAccountBookId?: string      // FK → AutoCountAccountBook.id
  autocountDebtorCode?: string        // e.g., "300-C001"
  creditTermOverride?: string         // Overrides account book default
  salesLocationOverride?: string      // Overrides account book default
  serviceProductOverrides?: [{        // Per-service overrides
    serviceType: string
    productCode: string
  }]
}
```

### Invoice (Extended)

```typescript
{
  ...existing fields...
  autocountRefId?: string            // AutoCount docNo (e.g., "I-000001")
  syncError?: string                 // Error message if sync failed
}
```

## Contraints
- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md.