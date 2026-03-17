# Roadmap

## Phase 1: Add EMAIL Line Item to Coway Export

**Goal:** Export CSV includes both SMS and EMAIL line items for Coway

**Requirements:**
- EMAIL-01: Fetch email count from recon server API
- EMAIL-02: Add EMAIL line item with proper description
- EMAIL-03: Verify export produces 2 line items

**Success Criteria:**
1. Preview API returns 2 line items for Coway
2. Export CSV has SMS and EMAIL rows with correct data
3. Description template applied correctly

**Plan:** 01-PLAN.md (1 plan, Wave 1)

### Phase 2: Add WHATSAPP line item to Coway export

**Goal:** Export CSV includes SMS, EMAIL, and WHATSAPP line items for Coway

**Requirements:**
- WA-01: Fetch WhatsApp count from WHATSAPP Recon Server API (serviceProvider: "ali")
- WA-02: Add WHATSAPP line item with proper description after SMS
- WA-03: Verify export produces 3 line items

**Success Criteria:**
1. Preview API returns 3 line items for Coway (SMS, EMAIL, WHATSAPP)
2. Export CSV has SMS, EMAIL, and WHATSAPP rows with correct data
3. serviceProvider: "ali" used in API call
4. Description template applied correctly

**Depends on:** Phase 1
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 2 to break down)

### Phase 3: AutoCount Invoice Generation - Generate invoices directly in AutoCount Cloud Accounting via API for Coway (Malaysia) Sdn Bhd

**Goal:** User can generate invoices directly in AutoCount via API for Coway (Malaysia) Sdn Bhd

**Requirements:**
- INV-01: Create new API endpoint POST /api/invoices/generate-auto
- INV-02: Create cowayBillingService.ts to fetch SMS, WhatsApp, Email billable data
- INV-03: Validate customer has AutoCount config (autocountAccountBookId, autocountDebtorCode)
- INV-04: Check for duplicate invoice before generation
- INV-05: Build AutoCount invoice payload using customer rates
- INV-06: Call AutoCount API to create invoice
- INV-07: Save invoice record to MongoDB with status tracking
- INV-08: Create Generate Invoice UI page at /billing/generate-invoice
- INV-09: Support Mock Mode for testing (AUTOCOUNT_MOCK=true)

**Success Criteria:**
1. API endpoint accepts customerId + billingMonth and returns invoice result
2. Billable data fetched correctly (SMS, WhatsApp, Email)
3. Invoice created in AutoCount with correct line items
4. Invoice record saved in MongoDB
5. Mock mode works for testing

**Plans:** 2/2 plans complete

Plans:
- [x] 03-01-PLAN.md -- Backend: cowayBillingService + API endpoint + mock mode (COMPLETED)
- [x] 03-02-PLAN.md -- UI: Generate Invoice page at /billing/generate-invoice (COMPLETED)

### Phase 4: omnisource

**Goal:** Make the billing system dynamic — allow adding customers with configurable data sources, AutoCount settings, products, and default field values.

**Requirements:**
- DS-01: Create DataSource interface with type, endpoint, auth, response mapping
- DS-02: Add dataSources field to Customer model
- DS-03: Create DataSource repository for CRUD operations
- DS-04: Refactor cowayBillingService to generic billingService
- DS-05: Update billing service to iterate through customer's dataSources
- DS-06: Create DataSource API endpoints for admin UI
- PM-01: Global product mappings (already exists via ServiceProductMapping)
- PM-02: Customer override for product codes (already supported via serviceProductOverrides)
- DV-01: Default field values in billing service (inherit + override)
- DV-02: Default values configurable in admin UI
- AC-01: Single AutoCount account per customer (autocountAccountBookId, autocountDebtorCode)
- UI-01: Wizard UI for customer setup

**Success Criteria:**
1. Data sources configurable per customer (not hardcoded)
2. Billing service works for any customer with configured data sources
3. Product mappings support global defaults with customer overrides
4. Admin can add new customers via wizard UI
5. Default field values inherit from system and can be overridden

**Depends on:** Phase 3
**Plans:** 2/2 plans complete

Plans:
- [x] 04-01-PLAN.md -- Backend: DataSource abstraction & generic billing service (COMPLETED)
- [x] 04-02-PLAN.md -- Frontend: Customer wizard UI (COMPLETED)

---

| Phase | Requirements | Status |
|-------|--------------|--------|
| Phase 1 | EMAIL-01, EMAIL-02, EMAIL-03 | Complete |
| Phase 2 | WA-01, WA-02, WA-03 | Planned |
| Phase 3 | INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09 | Complete |
| Phase 4 | DS-01, DS-02, DS-03, DS-04, DS-05, DS-06, PM-01, PM-02, DV-01, DV-02, AC-01, UI-01 | Complete |

**Coverage:** 27 requirements | Mapped: 27 | Unmapped: 0 ✓
