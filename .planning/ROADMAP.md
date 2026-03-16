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

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md -- Backend: cowayBillingService + API endpoint + mock mode (COMPLETED)
- [x] 03-02-PLAN.md -- UI: Generate Invoice page at /billing/generate-invoice (COMPLETED)

---

| Phase | Requirements | Status |
|-------|--------------|--------|
| Phase 1 | EMAIL-01, EMAIL-02, EMAIL-03 | Complete |
| Phase 2 | WA-01, WA-02, WA-03 | Planned |
| Phase 3 | INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09 | In Progress |

**Coverage:** 15 requirements | Mapped: 15 | Unmapped: 0 ✓
