# Phase 3: AutoCount Invoice Generation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning
**Source:** PRD Express Path (docs/superpowers/specs/2026-03-16-autocount-invoice-generation-design.md)

<domain>
## Phase Boundary

Generate invoices directly in AutoCount Cloud Accounting via API for Coway (Malaysia) Sdn Bhd. This phase adds a new "Generate Invoice" feature that creates invoices in AutoCount (not CSV export) using the same data fetching logic as the CSV Export feature.

**Scope (v1):** Coway (Malaysia) Sdn Bhd only

</domain>

<decisions>
## Implementation Decisions

### Architecture
- New API endpoint: `POST /api/invoices/generate-auto`
- New service: `cowayBillingService.ts` - fetches billable data for Coway
- Existing: `autocountInvoiceBuilder.ts` - builds AutoCount payload
- Existing: `autocountClient.ts` - calls AutoCount API

### API Contract
- Request: `{ customerId: string, billingMonth: string }`
- Response: `{ success: boolean, invoice?: {...}, error?: string }`

### Data Flow
1. Validate customer + billingMonth
2. Check for duplicate invoice (customer + billingMonth)
3. Fetch customer config from MongoDB
4. Validate AutoCount config (autocountAccountBookId, autocountDebtorCode)
5. Fetch billable data:
   - SMS from Coway API (via fetchCowayBillable)
   - WhatsApp from recon server (via fetchWhatsAppBillable)
   - Email from recon server (via fetchEmailReconSummary)
6. Build InvoiceLineItem[] using rates from customer config
7. Build AutoCount payload
8. Call AutoCount API

### Validation Rules
- Customer must have AutoCount config (autocountAccountBookId, autocountDebtorCode)
- No duplicate invoice for customer + billingMonth
- Billing month format: "YYYY-MM"

### Mock Mode
- Environment variable: `AUTOCOUNT_MOCK=true`
- When enabled: log payload, return fake success with mock docNo

### Customer Config Fields
- autocountAccountBookId: links to account book
- autocountDebtorCode: customer's debtor code
- serviceProductOverrides: product code per service type

</decisions>

<specifics>
## Specific Ideas

### File Changes
**New Files:**
- `/domain/services/cowayBillingService.ts` - fetches billable data for Coway
- `/app/billing/generate-invoice/page.tsx` - UI page

**Modified Files:**
- `/app/api/invoices/generate/route.ts` - extend OR create new endpoint

### User Flow
1. Navigate to Billing > Generate Invoice
2. Select Customer (only Coway in v1)
3. Select Billing Month (e.g., "2026-02")
4. Click "Generate Invoice"
5. See success with AutoCount doc number, or error details

### Sample Data (March 2026)
| Source | Count |
|--------|-------|
| SMS | 15,000 |
| WhatsApp | 2,500 |
| Email | 10,000 |

| Service | Rate | Total |
|---------|------|-------|
| SMS | RM 0.079 | RM 1,185.00 |
| WhatsApp | RM 0.079 | RM 197.50 |
| Email | RM 0.11 | RM 1,100.00 |
| **Total** | - | **RM 2,482.50** |

</specifics>

<deferred>
## Deferred Ideas

- Other clients (AIA, Zurich, FWD, etc.) - future phases
- WhatsApp description template issue (spec references wrong template)

</deferred>

---

*Phase: 03-autocount-invoice-generation*
*Context gathered: 2026-03-16 via PRD Express Path*
