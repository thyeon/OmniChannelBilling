---
phase: 04-omnisource
plan: 01
subsystem: database
tags: [mongodb, data-source, multi-tenant, billing]

# Dependency graph
requires:
  - phase: 03-autocount-invoice-generation
    provides: "Customer model, existing billing service, invoice generation APIs"
provides:
  - "DataSource model with type, auth, response mapping support"
  - "DataSource repository with full CRUD operations"
  - "Generic billingService that works for any customer with configured data sources"
  - "Customer type updated with dataSources array"
affects: [omnisource, multi-tenant-billing, data-source-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: ["DataSource abstraction pattern", "JSON path parsing for response mapping", "Repository pattern for MongoDB"]

key-files:
  created:
    - billing-app/src/domain/models/dataSource.ts
    - billing-app/src/infrastructure/db/dataSourceRepository.ts
    - billing-app/src/domain/services/billingService.ts
  modified:
    - billing-app/src/types/index.ts

key-decisions:
  - "Used responseMapping.usageCountPath for flexible JSON field extraction"
  - "Kept cowayBillingService for backward compatibility"
  - "Implemented setActiveDataSources for managing active/inactive sources"

patterns-established:
  - "DataSource abstraction: configurable billing data sources per customer"
  - "Response mapping: JSON path syntax for parsing API responses"
  - "Generic billing: iterate dataSources, create line items dynamically"

requirements-completed: [DS-01, DS-02, DS-03, DS-04, DS-05, PM-01, PM-02, DV-01]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 4 Plan 1: Dynamic Customer Billing Foundation Summary

**DataSource abstraction and generic billing service enabling multi-customer billing support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T03:40:49Z
- **Completed:** 2026-03-17T03:45:00Z
- **Tasks:** 4
- **Files modified:** 3 created, 1 modified

## Accomplishments

- Created DataSource model with configurable types (COWAY_API, RECON_SERVER, CUSTOM_REST_API)
- Added dataSources array to Customer type for multi-customer support
- Built DataSource repository with full CRUD operations (create, read, update, delete, setActive)
- Implemented generic billingService with dynamic data source iteration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DataSource interface and model** - `e1655c7` (feat)
2. **Task 2: Add dataSources to Customer type** - `611537c` (feat)
3. **Task 3: Create DataSource repository** - `c293143` (feat)
4. **Task 4: Refactor to generic billingService** - `fef9daa` (feat)

**Plan metadata:** `lmn012o` (docs: complete plan)

## Files Created/Modified

- `billing-app/src/domain/models/dataSource.ts` - DataSource interface with type, auth, response mapping
- `billing-app/src/types/index.ts` - Customer type updated with dataSources array
- `billing-app/src/infrastructure/db/dataSourceRepository.ts` - MongoDB CRUD for DataSource
- `billing-app/src/domain/services/billingService.ts` - Generic billing with dataSource iteration

## Decisions Made

- Used JSON path notation for responseMapping (e.g., "data.0.line_items.0.qty") to support flexible API responses
- Maintained backward compatibility with existing cowayBillingService.ts
- Added getNestedValue helper for JSON path parsing in CUSTOM_REST_API type

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified in the plan.

## Next Phase Readiness

- DataSource model and repository ready for API exposure
- billingService.generateBillableData(customerId, billingMonth) ready to replace cowayBillingService
- Can proceed to build UI for managing data sources (Plan 04-02)

---
*Phase: 04-omnisource*
*Completed: 2026-03-17*
