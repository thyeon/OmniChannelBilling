# Phase 4: omnisource - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the billing system dynamic — allow adding customers with configurable data sources, AutoCount settings, products, and default field values. Replace hardcoded Coway-specific logic with generic, configurable architecture.

**Scope (v1):**
- Abstract data source configuration (no hardcoded fetch functions)
- Single AutoCount account per customer
- Global product mappings with customer-level overrides
- Inherit + override default values
- Wizard UI for customer setup

</domain>

<decisions>
## Implementation Decisions

### Data Source Fetching
- **Abstract DataSource config**: Customer config contains list of DataSource objects
- DataSource structure:
  - `type`: 'COWAY_API' | 'RECON_SERVER' | 'CUSTOM_REST_API'
  - `serviceType`: 'SMS' | 'EMAIL' | 'WHATSAPP'
  - `apiEndpoint`: URL to call
  - `authType`: 'API_KEY' | 'BEARER_TOKEN' | 'BASIC_AUTH'
  - `authCredentials`: key/token/username/password
  - `responseMapping`: JSON path to usage count
- Billing service becomes generic: iterate through customer's dataSources, fetch and build line items

### AutoCount Integration
- **Single AutoCount account per customer** (not per service)
- Customer has: `autocountAccountBookId`, `autocountDebtorCode`
- All services (SMS/Email/WA) use same AutoCount linkage

### Product Mappings
- **Global + customer override** model
- Products defined globally per AutoCount account book (ServiceProductMapping)
- Customer can override product code per service type via `serviceProductOverrides`
- Existing `serviceProductOverrides` field in Customer model is sufficient

### Default Field Values
- **Inherit + override** approach
- System provides global defaults for rates, description templates, tax codes
- Customer can override per service type:
  - `rates[serviceType]`
  - `invoiceDescriptionTemplate`
  - `furtherDescriptionTemplate`
  - `taxCode`

### Admin UI Flow
- **Wizard flow** for new customer setup
- Steps: Add Customer → Data Sources → AutoCount → Products → Defaults
- Step-by-step guided configuration

</decisions>

<specifics>
## Specific Ideas

### Key Code Changes
- Refactor `cowayBillingService.ts` → generic `billingService.ts`
- Create `DataSource` interface and repository
- Add Data Source configuration UI in admin
- Wizard component for customer setup

### Existing Fields to Reuse
- Customer: `services`, `providers`, `reconServers`, `rates`, `autocountAccountBookId`, `autocountDebtorCode`, `serviceProductOverrides`, `invoiceDescriptionTemplate`, `furtherDescriptionTemplate`
- ServiceProductMapping: already exists, per account book

### Migration Note
- Existing Coway customer data should be migratable to new DataSource format

</specifics>

<deferred>
## Deferred Ideas

- Multiple AutoCount accounts per service — future enhancement
- Custom service types beyond SMS/Email/WA — future phase
- Plugin/extension approach for custom fetch logic — not in scope

</deferred>

---

*Phase: 04-omnisource*
*Context gathered: 2026-03-17*
