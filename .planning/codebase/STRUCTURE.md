# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
billing-app/
├── src/
│   ├── app/                 # Next.js App Router (UI pages + API routes)
│   │   ├── api/             # API route handlers
│   │   ├── billing/         # Billing page and API
│   │   ├── billing-export/  # Export feature pages
│   │   ├── customers/       # Customer management pages
│   │   ├── history/         # Invoice history pages
│   │   ├── autocount-settings/ # AutoCount settings page
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── app-sidebar.tsx  # Navigation sidebar
│   │   └── invoice-history.tsx
│   ├── domain/              # Domain layer (business logic)
│   │   ├── models/          # Domain entities/interfaces
│   │   └── services/        # Business logic services
│   ├── infrastructure/      # Infrastructure layer
│   │   ├── db/              # MongoDB repositories
│   │   └── external/        # External API clients
│   ├── hooks/               # React hooks
│   ├── lib/                 # Utilities and config
│   ├── providers/           # React context providers
│   ├── store/               # Zustand stores
│   ├── types/               # TypeScript type definitions
│   └── middleware.ts        # Next.js middleware
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

## Directory Purposes

### `billing-app/src/app/`
- Purpose: Next.js App Router - contains both UI pages and API routes
- Contains: Pages (`.tsx`), API routes (`route.ts`), layouts
- Key files: `layout.tsx`, `page.tsx`

### `billing-app/src/components/`
- Purpose: React components (UI components, feature components)
- Contains: `.tsx` component files
- Key files: `app-sidebar.tsx`, `invoice-history.tsx`, UI components in subdirectories

### `billing-app/src/domain/`
- Purpose: Domain layer - business logic, models, services
- Contains: Pure TypeScript with no framework dependencies
- Key files:
  - `domain/models/billingClient.ts` - BillingClient interface
  - `domain/models/billingDefaults.ts` - BillingDefaults interface
  - `domain/models/billingExportHistory.ts` - Export history interface
  - `domain/services/billingExportService.ts` - Export business logic

### `billing-app/src/infrastructure/`
- Purpose: Infrastructure layer - database and external service integrations
- Contains: Repository implementations, external API clients
- Key files:
  - `infrastructure/db/mongodb.ts` - MongoDB connection
  - `infrastructure/db/billingClientRepository.ts` - Client repository
  - `infrastructure/external/inglabClient.ts` - INGLAB API client

### `billing-app/src/hooks/`
- Purpose: Custom React hooks
- Contains: `useScheduler.ts`

### `billing-app/src/lib/`
- Purpose: Utilities and configuration
- Contains: `utils.ts`, auth config

### `billing-app/src/providers/`
- Purpose: React context providers
- Contains: `query-provider.tsx`, `session-provider.tsx`

### `billing-app/src/store/`
- Purpose: Zustand state management stores
- Contains: `useBillingStore.ts`, `useCustomerStore.ts`, `useScheduleStore.ts`

### `billing-app/src/types/`
- Purpose: TypeScript type definitions
- Contains: `index.ts` with all core types

## Key File Locations

### Entry Points
- Root layout: `billing-app/src/app/layout.tsx`
- Home page: `billing-app/src/app/page.tsx`

### Configuration
- Next.js config: `billing-app/next.config.js` (implied from Next.js usage)
- TypeScript config: `billing-app/tsconfig.json` (implied)
- Tailwind config: `billing-app/tailwind.config.js` (implied)
- Package manifest: `billing-app/package.json`

### API Routes
- Billing export: `billing-app/src/app/api/billing/clients/route.ts`
- Billing export: `billing-app/src/app/api/billing/defaults/route.ts`
- Billing export: `billing-app/src/app/api/billing/preview/route.ts`
- Billing export: `billing-app/src/app/api/billing/export/route.ts`
- Billing export: `billing-app/src/app/api/billing/history/route.ts`
- Customers: `billing-app/src/app/api/customers/route.ts`
- Customers: `billing-app/src/app/api/customers/[id]/route.ts`
- Invoices: `billing-app/src/app/api/invoices/generate/route.ts`
- Usage: `billing-app/src/app/api/usage/route.ts`

### UI Pages
- Billing: `billing-app/src/app/billing/page.tsx`
- Billing Export: `billing-app/src/app/billing-export/page.tsx`
- Billing Export Clients: `billing-app/src/app/billing-export/clients/page.tsx`
- Billing Export Settings: `billing-app/src/app/billing-export/settings/page.tsx`
- Billing Export History: `billing-app/src/app/billing-export/history/page.tsx`
- Customers: `billing-app/src/app/customers/page.tsx`
- AutoCount Settings: `billing-app/src/app/autocount-settings/page.tsx`
- Invoice History: `billing-app/src/app/history/page.tsx`
- History Detail: `billing-app/src/app/history/[id]/page.tsx`

### Domain Layer
- Models: `billing-app/src/domain/models/`
- Services: `billing-app/src/domain/services/`

### Infrastructure Layer
- Database: `billing-app/src/infrastructure/db/`
- External APIs: `billing-app/src/infrastructure/external/`

## Naming Conventions

### Files
- **Pages:** `page.tsx` for route components, `[id]/page.tsx` for dynamic routes
- **API Routes:** `route.ts` for route handlers
- **Models:** `*.ts` (singular, e.g., `billingClient.ts`)
- **Repositories:** `*Repository.ts` (e.g., `billingClientRepository.ts`)
- **Services:** `*Service.ts` or `*Builder.ts` (e.g., `billingExportService.ts`, `autocountInvoiceBuilder.ts`)
- **Stores:** `use*Store.ts` (Zustand convention, e.g., `useBillingStore.ts`)
- **Components:** PascalCase (e.g., `InvoiceHistoryPanel.tsx`, `ServiceCard`)
- **UI Components:** shadcn/ui files in `components/ui/`

### Directories
- **Pages/API:** kebab-case (e.g., `billing-export`, `autocount-settings`)
- **Domain models:** singular (`models/`, not `model/`)
- **Infrastructure:** descriptive (`db/`, `external/`)

### Variables/Functions
- **Functions:** camelCase (e.g., `findAllBillingClients`, `generatePreview`)
- **Interfaces/Types:** PascalCase (e.g., `BillingClient`, `PreviewResult`)
- **Constants:** UPPER_SNAKE_CASE for values (e.g., `SUPPORTED_CLIENTS`, `MANDATORY_EMPTY_HEADERS`)

## Where to Add New Code

### New Feature (New Page)
- UI page: `billing-app/src/app/[feature-name]/page.tsx`
- API routes: `billing-app/src/app/api/[feature-name]/route.ts`
- Store (if needed): `billing-app/src/store/use*Store.ts`
- Tests: Not currently present (no test directory)

### New API Endpoint
- Route handler: `billing-app/src/app/api/[feature]/route.ts`
- Route handler with ID: `billing-app/src/app/api/[feature]/[id]/route.ts`

### New Domain Model
- Interface: `billing-app/src/domain/models/[modelName].ts`
- Add to exports if there's a barrel file

### New Domain Service
- Service: `billing-app/src/domain/services/[serviceName].ts`
- Import domain models, not infrastructure

### New Repository
- Repository: `billing-app/src/infrastructure/db/[entityName]Repository.ts`
- Import domain model for types

### New External Client
- Client: `billing-app/src/infrastructure/external/[serviceName]Client.ts`
- Use environment variables for API keys/endpoints

### New Component
- Feature component: `billing-app/src/components/[ComponentName].tsx`
- UI component: `billing-app/src/components/ui/[component].tsx`

### New Store (Zustand)
- Store: `billing-app/src/store/use[Feature]Store.ts`

## Special Directories

### `billing-app/src/components/ui/`
- Purpose: shadcn/ui component library
- Generated: Yes (from shadcn CLI)
- Committed: Yes

### `billing-app/.next/`
- Purpose: Next.js build output
- Generated: Yes (by Next.js)
- Committed: No (typically in .gitignore)

### `billing-app/public/exports/`
- Purpose: Exported billing files storage
- Generated: At runtime when users export
- Committed: No

---

*Structure analysis: 2026-03-15*
