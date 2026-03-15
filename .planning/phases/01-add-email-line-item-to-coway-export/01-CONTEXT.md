# Phase 1: Add EMAIL Line Item to Coway Export - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add EMAIL as a second line item to Coway (Malaysia) billing export CSV, in addition to existing SMS. Export will have 2 rows: SMS and EMAIL.

</domain>

<decisions>
## Implementation Decisions

### Already Specified (from plan document)
- API endpoint: `http://128.199.165.110:8080/invoice/findSentCount`
- Rate: RM 0.11 per email
- Product code: "Email-Blast"
- Description template: "For {BillingCycle}, the total number of Email sent was {EmailCount}, charged at RM {EmailRate} per message."

### Implementation Pattern
- Follow existing SMS line item implementation in billingExportService.ts
- Use existing `fetchEmailReconSummary` from reconClient.ts

### Claude's Discretion
- Exact code structure (can follow SMS pattern)
- Error handling approach (can use same pattern as SMS)
- Import statements

</decisions>

<specifics>
## Specific Ideas

- Plan document at `/docs/plans/2026-03-15-add-email-line-item-to-coway-export.md` provides full implementation details
- No additional requirements from discussion

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchEmailReconSummary` in `reconClient.ts` - already implemented, just needs import
- SMS line item pattern in `billingExportService.ts` - template to follow

### Established Patterns
- SMS line item: fetch from API → get rate from customer config → resolve template → push to line_items array
- Same pattern applies for EMAIL

### Integration Points
- Modify `billingExportService.ts` - add EMAIL fetch and line item after SMS logic
- Import `fetchEmailReconSummary` from `@/infrastructure/external/reconClient`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-add-email-line-item-to-coway-export*
*Context gathered: 2026-03-15*
