# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Hardcoded API Credentials:**
- Issue: API token hardcoded as fallback in `inglabClient.ts` line 2
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/infrastructure/external/inglabClient.ts`
- Impact: Security risk if environment variables are not set; credentials could be exposed in logs
- Fix approach: Remove fallback credentials; ensure all deployments set environment variables

**Hardcoded Default Values:**
- Issue: Default values hardcoded in `billingExportService.ts` instead of being configurable
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/billingExportService.ts`
- Impact: Business users cannot change defaults without code changes; values like `sales_agent: "Darren Lim"` are hardcoded
- Fix approach: Move defaults to database configuration (billing_defaults table already exists)

**Hardcoded Invoice Account Number:**
- Issue: `accNo: "500-0000"` is hardcoded in `autocountInvoiceBuilder.ts` line 129 with TODO comment
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/autocountInvoiceBuilder.ts`
- Impact: Different account books may need different expense account numbers
- Fix approach: Add `defaultAccNo` field to account book configuration

**Duplicate Billing Export Logic:**
- Issue: Both `process_billing.js` (Node.js script) and `billingExportService.ts` implement CSV generation
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/process_billing.js`, `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/billingExportService.ts`
- Impact: Maintenance burden; changes must be made in two places; risk of inconsistency
- Fix approach: Deprecate `process_billing.js` and use the Next.js API exclusively

**Large UI Components:**
- Issue: `customers/page.tsx` has 1039 lines; `billing/page.tsx` has 796 lines
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/customers/page.tsx`, `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/billing/page.tsx`
- Impact: Difficult to maintain; high cognitive load for modifications
- Fix approach: Extract into smaller components (e.g., CustomerForm, CustomerTable, BillingFilters)

## Security Considerations

**Authentication Completely Bypassed:**
- Risk: No routes are protected; middleware has empty matcher
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/middleware.ts`
- Current mitigation: None
- Recommendations: Enable authentication for all routes; configure protected paths in middleware

**API Rate Limiting Missing:**
- Risk: No rate limiting on API endpoints; vulnerable to abuse
- Files: All API routes in `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/api/`
- Current mitigation: AutoCount client has retry logic but no application-level rate limiting
- Recommendations: Add Next.js rate limiting or use external service like Upstash

**Exported CSV Files Stored in Public Directory:**
- Risk: Exported billing data stored in `public/exports/` is publicly accessible
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/api/billing/export/route.ts`
- Current mitigation: None
- Recommendations: Store exports in authenticated endpoints or use signed URLs

**No Input Validation on Some API Routes:**
- Risk: Some routes accept user input without thorough validation
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/api/invoices/generate/route.ts`
- Current mitigation: Basic required field checks
- Recommendations: Add Zod schemas for request body validation

## Performance Bottlenecks

**Synchronous File Writes:**
- Problem: Using `fs.writeFileSync` in API route blocks the event loop
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/api/billing/export/route.ts` line 90
- Cause: Synchronous I/O in Next.js API route
- Improvement path: Use `fs.promises.writeFile` or stream to client directly

**No Pagination on Database Queries:**
- Problem: `findAllCustomers()`, `findAllInvoices()` load all documents into memory
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/infrastructure/db/customerRepository.ts`, `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/infrastructure/db/invoiceRepository.ts`
- Cause: No limit/skip parameters
- Improvement path: Add pagination support; implement cursor-based pagination for large datasets

**N+1 Query Pattern in Invoice Builder:**
- Problem: `findMappingByAccountBookAndService` called in loop for each line item
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/autocountInvoiceBuilder.ts` lines 91-96
- Cause: No batch fetching of product mappings
- Improvement path: Fetch all mappings for account book upfront, then filter in memory

## Known Bugs

**Missing Error Handling in Scheduler:**
- Symptoms: Silent failures when customer not found during scheduled job execution
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/hooks/useScheduler.ts` lines 279-283, 339-343
- Trigger: When customer is deleted after job is scheduled
- Workaround: Manual reprocessing of failed jobs

**Invoice Generation Stores Without API Response:**
- Symptoms: Invoice saved with GENERATED status even if AutoCount sync fails
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/app/api/invoices/generate/route.ts` lines 84, 94-102
- Trigger: When buildResult.success is false
- Workaround: Job retry mechanism exists but could be improved

## Fragile Areas

**Billing Export Service - Client Mapping:**
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/billingExportService.ts`
- Why fragile: Client mapping relies on exact string match; silently skips unknown clients
- Safe modification: Add logging when clients are skipped; consider warning UI
- Test coverage: None

**AutoCount Invoice Builder - Configuration Resolution:**
- Files: `/Users/thyeonyam/Desktop/YTO doc/BillingSolutions/billing-app/src/domain/services/autocountInvoiceBuilder.ts`
- Why fragile: Complex fallback chain (customer override -> account book default -> error)
- Safe modification: Add validation for all required fields before building payload
- Test coverage: None

## Scaling Limits

**MongoDB Connection:**
- Current capacity: Single MongoClient instance (singleton pattern)
- Limit: Connection pooling handled by MongoDB driver; no explicit pool size configuration
- Scaling path: Add connection string with proper pool size; consider read replicas for read-heavy operations

**AutoCount API Rate Limiting:**
- Current capacity: 3 retries with exponential backoff (2s, 4s, 8s)
- Limit: No explicit rate limit handling beyond retries
- Scaling path: Implement proper rate limit tracking; queue requests when limit approached

**File Storage:**
- Current capacity: Local filesystem in `public/exports/`
- Limit: Not suitable for production with multiple instances; no backup strategy
- Scaling path: Use cloud storage (S3, Azure Blob); implement cleanup policy for old exports

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Domain services, repositories, utility functions
- Files: Entire `/src/domain/` and `/infrastructure/` directories
- Risk: Business logic bugs go undetected; refactoring risks breaking functionality
- Priority: High

**No Integration Tests:**
- What's not tested: API routes, database operations
- Files: All `/src/app/api/` routes
- Risk: API contract changes not detected; integration issues missed
- Priority: High

**No E2E Tests:**
- What's not tested: Full user workflows
- Files: N/A
- Risk: User-facing bugs in critical paths (billing export, invoice generation)
- Priority: Medium

## Missing Critical Features

**Audit Logging:**
- Problem: No comprehensive audit trail for billing exports and invoice syncs
- Blocks: Compliance requirements; debugging customer issues; reconciliation

**Data Validation:**
- Problem: No validation of imported billing data quality
- Blocks: Reliable automated billing; requires manual review

**Error Notifications:**
- Problem: Failed jobs don't notify administrators
- Blocks: Quick response to billing issues; requires manual monitoring

---

*Concerns audit: 2026-03-15*
