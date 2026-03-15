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

---

| Phase | Requirements | Status |
|-------|--------------|--------|
| Phase 1 | EMAIL-01, EMAIL-02, EMAIL-03 | Complete |
| Phase 2 | WA-01, WA-02, WA-03 | Planned |

**Coverage:** 6 requirements | Mapped: 6 | Unmapped: 0 ✓
