# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- Components: `PascalCase.tsx` (e.g., `Button.tsx`, `AppSidebar.tsx`)
- Utilities/Lib: `camelCase.ts` (e.g., `utils.ts`, `cn.ts`)
- Services: `camelCase.ts` (e.g., `billingExportService.ts`)
- Repositories: `camelCase.ts` (e.g., `billingClientRepository.ts`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useScheduler.ts`)
- Stores: `camelCase.ts` with `use` prefix (e.g., `useBillingStore.ts`)
- Types: `camelCase.ts` or `PascalCase.ts` (e.g., `index.ts`, `billingClient.ts`)
- API Routes: `route.ts` in directory-based routes (e.g., `/api/billing/clients/route.ts`)

**Functions:**
- camelCase: `generatePreview()`, `fetchIngLabBillable()`, `cn()`
- PascalCase for factory functions: `buttonVariants` (CVA pattern)

**Variables:**
- camelCase: `billingMonth`, `isLoading`, `sourceClientName`
- snake_case for database fields: `source_client_name`, `debtor_code`, `tax_entity`

**Types:**
- PascalCase interfaces: `BillingClient`, `InvoiceHistory`, `Customer`
- PascalCase types: `ServiceType`, `InvoiceStatus`, `ConnectionStatus`

## Code Style

**Formatting:**
- Tool: Prettier (via Next.js ESLint config)
- Uses ESLint with `next/core-web-vitals` and `next/typescript` presets

**Linting:**
- Tool: ESLint v8 with `eslint-config-next` 14.2.35
- TypeScript strict mode enabled in `tsconfig.json`
- Key rules: Strict TypeScript, noImplicitAny, noUnusedLocals

**Tailwind CSS:**
- Used for all styling
- Pattern: `className={cn("base-classes", condition && "conditional-classes")}`
- Utility function `cn()` from `@/lib/utils` wraps `clsx` and `tailwind-merge`

## Import Organization

**Order:**
1. External libraries: `react`, `next`, `lucide-react`
2. UI components: `@radix-ui/react-*`
3. Path aliases: `@/lib/*`, `@/components/*`, `@/domain/*`, `@/infrastructure/*`, `@/types/*`, `@/store/*`, `@/hooks/*`
4. Relative imports (rarely used)

**Path Aliases:**
- `@/*` maps to `./src/*`
- Used consistently throughout: `import { cn } from "@/lib/utils"`
- Used for: components, domain models, services, repositories, stores, hooks, types

## Error Handling

**API Routes:**
```typescript
export async function GET(request: NextRequest) {
  try {
    // business logic
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching billing clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing clients" },
      { status: 500 }
    );
  }
}
```

**Services:**
- Use try/catch for async operations
- Return default values or throw with descriptive messages
- Example: `catch { return DEFAULT_FIELD_VALUES }` (silent fallback)

**External Clients:**
- Throw descriptive errors: `throw new Error(\`Failed to fetch INGLAB clients: ${response.status} - ${error}\`)`

## Logging

**Framework:** `console` (no structured logger)
**Patterns:**
- Use `console.error()` for errors in catch blocks
- Include operation context: `console.error("Error fetching billing clients:", error)`

## Comments

**When to Comment:**
- JSDoc for public functions and types
- Business logic explanations
- Example from `billingExportService.ts`:
```typescript
/** Generate preview data for a given period and optional client filter */
export async function generatePreview(...): Promise<PreviewResult>
```

**TSDoc:**
- Used for documenting exported functions
- Brief descriptions, not extensive

## Function Design

**Size:** No strict limits, but functions typically do one thing

**Parameters:**
- Typed explicitly in TypeScript
- Optional parameters use `?` operator
- Example: `(period: string, client?: string)`

**Return Values:**
- Always typed explicitly
- Use interfaces/types for complex returns: `Promise<PreviewResult>`

## Module Design

**Exports:**
- Named exports preferred
- Example: `export async function generatePreview(...)`
- Example: `export const useBillingStore = create<BillingStore>(...)`

**Barrel Files:**
- `src/types/index.ts` - central type exports
- `src/lib/utils.ts` - shared utilities
- Domain models exported directly from their files

---

*Convention analysis: 2026-03-15*
