# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Status:** Not configured

The codebase currently has **no test framework or test files** configured. This is a significant gap in the codebase.

## Test File Organization

**Location:** Not applicable - no tests exist

**Naming:** Not applicable

**Structure:** Not applicable

## Test Structure

**Suite Organization:** Not applicable

**Patterns:** Not applicable

## Mocking

**Framework:** Not configured

**Patterns:** Not applicable

**What to Mock:** Not applicable

**What NOT to Mock:** Not applicable

## Fixtures and Factories

**Test Data:** Not applicable

**Location:** Not applicable

## Coverage

**Requirements:** None - no coverage enforcement

**View Coverage:** Not applicable

## Test Types

**Unit Tests:**
- Not implemented
- Should be added for:
  - Domain services: `billingExportService.ts`, `autocountInvoiceBuilder.ts`, `templateResolver.ts`, `reconService.ts`
  - Utility functions: `lib/utils.ts`, `lib/cn()`
  - Hooks: `useScheduler.ts`
  - Store logic: Zustand stores

**Integration Tests:**
- Not implemented
- Should be added for:
  - API routes: all files in `src/app/api/*`
  - Repository functions: database operations

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:** Not applicable

**Error Testing:** Not applicable

---

## Recommendations

The codebase would benefit from adding a test framework:

1. **Add Vitest or Jest** - Vitest recommended for Next.js projects (faster, Vite-based)
2. **Test locations:** Co-located with source files using `.test.ts` or `.test.tsx` suffix
3. **Priority areas for tests:**
   - `src/domain/services/billingExportService.ts` - complex business logic with CSV generation
   - `src/lib/utils.ts` - utility functions used throughout
   - `src/hooks/useScheduler.ts` - complex scheduling logic
   - API routes for critical workflows

4. **Mock external dependencies:**
   - MongoDB - use `mongodb-memory-server` or mock collections
   - External APIs (INGLAB, AutoCount) - use MSW or fetch mocks

5. **Coverage target:** Start with 70% for business logic, expand over time

---

*Testing analysis: 2026-03-15*
