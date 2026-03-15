# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**Billing/Invoicing:**
- **AutoCount Cloud Accounting API** - Invoice creation and accounting integration
  - Base URL: `https://accounting-api.autocountcloud.com`
  - SDK/Client: Custom client in `src/infrastructure/external/autocountClient.ts`
  - Auth: API Key authentication via `Key-ID` and `API-Key` headers
  - Features: Invoice creation, debtor listing, connection testing

- **INGLAB Partner API** - Client and billable data retrieval
  - Base URL: Configurable via `AUTOCOUNT_BASE_URL` env var (defaults to `https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB`)
  - SDK/Client: Custom client in `src/infrastructure/external/inglabClient.ts`
  - Auth: Bearer token via `Authorization` header
  - Features: Fetch clients, fetch billable data by period

- **Recon Servers** - Usage reconciliation data fetching
  - SDK/Client: Custom client in `src/infrastructure/external/reconClient.ts`
  - Auth: userId/secret or x-token depending on server type
  - Features: Usage summary, email reconciliation data
  - Timeout: 30 seconds per request

## Data Storage

**Databases:**
- **MongoDB** - Primary data store
  - Connection: `MONGODB_URI` env var (defaults to `mongodb://localhost:27017/billing`)
  - Client: `mongodb` npm package (v6.21.0)
  - Implementation: Singleton pattern in `src/infrastructure/db/mongodb.ts`
  - Collections: customers, invoices, schedules, billing_clients, billing_defaults, billing_export_history, autocount_account_books, service_product_mappings

**File Storage:**
- Local filesystem only
- Exports stored in: `billing-app/public/exports/`

**Caching:**
- None detected (no Redis or similar)

## Authentication & Identity

**Auth Provider:**
- **Google OAuth** via NextAuth.js
  - Implementation: `src/lib/auth/config.ts`
  - Configured with GoogleProvider
  - Environment: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Authorized users: Controlled via `src/lib/auth/authorized-users.ts`
  - Role-based access: Roles assigned via JWT token

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, LogRocket, etc.)

**Logs:**
- Console logging via standard `console.log/error`
- No structured logging framework detected

## CI/CD & Deployment

**Hosting:**
- Vercel (recommended in README)
- Self-hosted supported via Docker

**CI Pipeline:**
- Not detected (no GitHub Actions, CircleCI, etc.)

**Containerization:**
- Dockerfile present
- docker-compose.yml with MongoDB service (uses mongo:4.4 image)

## Environment Configuration

**Required env vars:**
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB_NAME` - Database name (default: "billing")
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `NEXTAUTH_URL` - NextAuth.js URL (default: "http://localhost:3000")
- `AUTOCOUNT_BASE_URL` - AutoCount API base URL (optional)
- `AUTOCOUNT_API_TOKEN` - AutoCount API token (optional)

**Secrets location:**
- `.env.local` file (not committed to git)

## Webhooks & Callbacks

**Incoming:**
- Not detected (no webhook endpoints)

**Outgoing:**
- Not detected (no outgoing webhooks)

---

*Integration audit: 2026-03-15*
