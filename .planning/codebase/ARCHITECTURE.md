# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Layered Architecture (Clean Architecture)

The codebase follows a layered architecture with clear separation of concerns, as defined in `ARCHITECTURE.md` at the project root. This architecture is enforced and must be followed for all code changes.

**Key Characteristics:**
- Strict layer separation: UI → API → Domain → Infrastructure
- Dependencies flow downward only
- Domain layer is framework-agnostic and contains all business logic
- Infrastructure implements interfaces defined by domain

## Layers

### UI / Client Layer (`billing-app/src/app/`, `billing-app/src/components/`)
- Purpose: User interface and interaction handling
- Location: `billing-app/src/app/` (Next.js App Router pages)
- Contains: React components, page layouts, UI components
- Depends on: API layer via fetch/React Query
- Used by: End users, browsers

**Key Components:**
- Page components: `billing-app/src/app/billing/page.tsx`, `billing-app/src/app/customers/page.tsx`, `billing-app/src/app/autocount-settings/page.tsx`
- UI components: `billing-app/src/components/ui/` (shadcn/ui components)
- App sidebar: `billing-app/src/components/app-sidebar.tsx`

### API / Application Layer (`billing-app/src/app/api/`)
- Purpose: Request handling, orchestration, input/output transformation
- Location: `billing-app/src/app/api/` (Next.js API routes)
- Contains: Route handlers for REST endpoints
- Depends on: Domain layer services and models
- Used by: UI layer (fetch calls)

**Key API Endpoints:**
- `/api/billing/clients`, `/api/billing/defaults`, `/api/billing/export`, `/api/billing/preview` - Billing export feature
- `/api/customers` - Customer CRUD
- `/api/usage` - Usage data fetching
- `/api/invoices/generate` - Invoice generation
- `/api/autocount/*` - AutoCount integration endpoints

**Example Pattern (from `billing-app/src/app/api/billing/clients/route.ts`):**
```typescript
export async function GET() {
  const clients = await findAllBillingClients(); // Domain call
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const newClient: BillingClient = { /* ... */ };
  const created = await insertBillingClient(newClient); // Domain call
  return NextResponse.json(created, { status: 201 });
}
```

### Domain / Business Logic Layer (`billing-app/src/domain/`)
- Purpose: Core business rules, calculations, validation
- Location: `billing-app/src/domain/`
- Contains: Models (interfaces), Services (business logic)
- Depends on: No outward dependencies (pure TypeScript)
- Used by: API layer

**Domain Models:**
- `billing-app/src/domain/models/billingClient.ts` - Client mapping entity
- `billing-app/src/domain/models/billingDefaults.ts` - Default field values
- `billing-app/src/domain/models/billingExportHistory.ts` - Export history
- `billing-app/src/domain/models/autoCountAccountBook.ts` - AutoCount account books
- `billing-app/src/domain/models/serviceProductMapping.ts` - Product mappings

**Domain Services:**
- `billing-app/src/domain/services/billingExportService.ts` - Billing export logic (preview, CSV generation, export)
- `billing-app/src/domain/services/reconService.ts` - Reconciliation logic
- `billing-app/src/domain/services/autocountInvoiceBuilder.ts` - Invoice building for AutoCount
- `billing-app/src/domain/services/templateResolver.ts` - Template resolution

**Example Service Pattern (from `billing-app/src/domain/services/billingExportService.ts`):**
```typescript
export async function generatePreview(period: string, clientName?: string): Promise<PreviewResult> {
  const defaults = await getFieldDefaults();
  const clientMappings = await getClientMappings();
  const billableItems = await fetchIngLabBillable(period);
  // Business logic: filter, transform, calculate
  return result;
}

export function generateCSV(data: PreviewRow[]): string {
  // Pure function: no side effects, deterministic
  const headers = [...];
  const rows = data.map(...);
  return [headers.join(","), ...rows].join("\n");
}
```

### Infrastructure Layer (`billing-app/src/infrastructure/`)
- Purpose: Database access, external APIs
- Location: `billing-app/src/infrastructure/`
- Contains: Database repositories, external API clients
- Depends on: Domain models (for types)
- Used by: Domain services, API layer

**Database Infrastructure:**
- `billing-app/src/infrastructure/db/mongodb.ts` - MongoDB connection singleton
- `billing-app/src/infrastructure/db/billingClientRepository.ts` - Client CRUD operations
- `billing-app/src/infrastructure/db/billingDefaultsRepository.ts` - Defaults CRUD
- `billing-app/src/infrastructure/db/billingExportHistoryRepository.ts` - History CRUD
- `billing-app/src/infrastructure/db/customerRepository.ts` - Customer repository
- `billing-app/src/infrastructure/db/invoiceRepository.ts` - Invoice repository

**External API Clients:**
- `billing-app/src/infrastructure/external/inglabClient.ts` - INGLAB Partner API client
- `billing-app/src/infrastructure/external/autocountClient.ts` - AutoCount API client
- `billing-app/src/infrastructure/external/reconClient.ts` - Reconciliation server client

**Example Repository Pattern (from `billing-app/src/infrastructure/db/billingClientRepository.ts`):**
```typescript
export async function findAllBillingClients(): Promise<BillingClient[]> {
  const collection = await getCollection();
  const docs = await collection.find({ is_active: true }).toArray();
  return docs.map(toBillingClient);
}

export async function insertBillingClient(client: BillingClient): Promise<BillingClient> {
  const collection = await getCollection();
  await collection.updateOne(
    { id: client.id },
    { $set: { ...client, updated_at: now }, $setOnInsert: { created_at: now } },
    { upsert: true }
  );
  return client;
}
```

## Data Flow

**Billing Export Flow:**

1. User selects period and client in UI (`billing-app/src/app/billing-export/page.tsx`)
2. UI calls `/api/billing/preview` API endpoint
3. API route invokes `billingExportService.generatePreview()`
4. Service fetches data from multiple sources:
   - `inglabClient.fetchIngLabBillable()` - External billing data
   - `billingClientRepository.findAllBillingClients()` - Client mappings
   - `billingDefaultsRepository.findAllBillingDefaults()` - Default values
5. Service applies business logic (filtering, calculations, CSV formatting)
6. API returns preview data to UI
7. User clicks "Export"
8. UI calls `/api/billing/export` API endpoint
9. Service generates CSV and saves history record
10. Export completes (download or save mode)

**Invoice Generation Flow:**

1. User selects customer and billing month in `billing-app/src/app/billing/page.tsx`
2. UI calls `/api/usage` to fetch usage data
3. API invokes recon service to gather data from recon servers and providers
4. UI displays usage cards with discrepancy calculations
5. User clicks "Generate Invoice"
6. UI calls `/api/invoices/generate` API endpoint
7. API builds invoice using `autocountInvoiceBuilder`
8. Invoice is synced to AutoCount via `autocountClient`
9. History record saved to `invoiceRepository`

## Key Abstractions

**Repository Pattern:**
- Purpose: Abstract database operations
- Examples: `billingClientRepository.ts`, `customerRepository.ts`, `invoiceRepository.ts`
- Pattern: Each repository is a set of async functions for CRUD operations

**Service Pattern:**
- Purpose: Encapsulate business logic
- Examples: `billingExportService.ts`, `reconService.ts`, `autocountInvoiceBuilder.ts`
- Pattern: Pure async functions that orchestrate domain logic

**Client Abstraction:**
- Purpose: Abstract external API calls
- Examples: `inglabClient.ts`, `autocountClient.ts`, `reconClient.ts`
- Pattern: Functions that make HTTP calls and return typed responses

**State Management (Zustand):**
- Purpose: Client-side state management
- Examples: `useBillingStore.ts`, `useCustomerStore.ts`, `useScheduleStore.ts`
- Pattern: Zustand stores with typed interfaces

## Entry Points

**API Entry Points:**
- `/api/billing/*` - Billing export API (defined in `billing-app/src/app/api/billing/`)
- `/api/customers/*` - Customer management API (defined in `billing-app/src/app/api/customers/`)
- `/api/invoices/*` - Invoice generation API (defined in `billing-app/src/app/api/invoices/`)
- `/api/autocount/*` - AutoCount integration API (defined in `billing-app/src/app/api/autocount/`)
- `/api/usage` - Usage data API (defined in `billing-app/src/app/api/usage/route.ts`)

**UI Entry Points:**
- `/billing` - Main billing page (file: `billing-app/src/app/billing/page.tsx`)
- `/billing-export` - Billing export page (file: `billing-app/src/app/billing-export/page.tsx`)
- `/customers` - Customer management page (file: `billing-app/src/app/customers/page.tsx`)
- `/autocount-settings` - AutoCount settings page (file: `billing-app/src/app/autocount-settings/page.tsx`)
- `/history` - Invoice history page (file: `billing-app/src/app/history/page.tsx`)

**Server Entry Point:**
- `billing-app/src/app/layout.tsx` - Root layout with providers (QueryProvider, SessionProvider)

## Error Handling

**Strategy:** Try-catch in API routes, typed error responses

**Patterns:**
- API routes wrap logic in try-catch, return NextResponse.json with error and status 500
- Domain services may throw errors that propagate up
- External API clients throw errors on non-2xx responses

**Example (from `billing-app/src/app/api/billing/clients/route.ts`):**
```typescript
export async function GET() {
  try {
    const clients = await findAllBillingClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching billing clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing clients" },
      { status: 500 }
    );
  }
}
```

## Cross-Cutting Concerns

**Logging:** Console.log in API routes and catch blocks; no structured logging framework

**Validation:** Basic input validation in API routes (e.g., check for required fields); business validation in domain layer

**Authentication:** NextAuth.js configured (`billing-app/src/app/api/auth/[...nextauth]/route.ts`); currently bypassed via empty middleware matcher

**Type Safety:** TypeScript throughout; domain models define interfaces used across layers

---

*Architecture analysis: 2026-03-15*
