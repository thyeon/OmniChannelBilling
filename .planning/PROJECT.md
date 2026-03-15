# Add EMAIL Line Item to Coway Export

## What This Is

Add EMAIL as a second line item to the Coway (Malaysia) Sdn Bhd billing export CSV, in addition to the existing SMS line item.

## Core Value

Enable Coway (Malaysia) to bill for both SMS and EMAIL services in a single export CSV.

## Requirements

### Active

- [ ] Add EMAIL line item to Coway billing export
- [ ] Fetch email count from recon server API
- [ ] Apply EMAIL rate (RM 0.11) and product code ("Email-Blast")
- [ ] Generate proper description using template
- [ ] Verify export produces 2 line items (SMS + EMAIL)

### Out of Scope

- Other customers (this feature is Coway-specific)
- Other services (WHATSAPP rate is 0, not billed)

## Context

**Existing Codebase:**
- Billing export already works for SMS
- Coway customer config exists in MongoDB with EMAIL settings
- Recon client has existing fetch functions

**Files to Modify:**
- `billing-app/src/domain/services/billingExportService.ts` - Add EMAIL line item generation

**Key Dependencies:**
- Recon server API: `http://128.199.165.110:8080/invoice/findSentCount`
- Token: `fGxqeS9pzR7duRBV7xpXSkFBPtQFKn`

## Constraints

- **Tech Stack**: TypeScript, Next.js, MongoDB - must follow existing patterns
- **API**: Use existing reconClient infrastructure
- **Customer Config**: Already stored in MongoDB, no config changes needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use existing reconClient | Existing infrastructure for fetching recon data | — Pending |
| Apply rate from customer config | Allows flexibility per customer | — Pending |

---
*Last updated: 2026-03-15 after initialization*
