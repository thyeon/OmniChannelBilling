# TASK: Backend Integration — Persistence Layer & First Recon API Call

## Objective

Transition from in-memory mock data to a real persistent backend with MongoDB, and implement the first real external API call to the "Ali SMS2" Reconciliation Server for SMS usage data.

---

## Pre-requisites

Before implementation, the following gap must be addressed:

### Missing Field: `userId` on `ReconServer`

The current `ReconServer` interface has:
- `apiKey` → maps to the Recon API `secret` parameter
- `apiEndpoint` → maps to the Recon API URL (e.g., `https://sms2.g-i.com.my/api/summary`)

**Missing:** A `userId` field → maps to the Recon API `user` parameter.

Each Reconciliation Server requires a `userId` to authenticate API calls. This must be added to:
1. The `ReconServer` TypeScript interface
2. The Customer form UI (input field for userId per recon server)
3. The MongoDB schema
4. The seed data

---

## Reconciliation Service API — "Ali SMS2"

### Endpoint

```
POST https://sms2.g-i.com.my/api/summary
```

### Request Body

```json
{
    "user": "gi_xHdw6",
    "secret": "VpHVSMLS1E4xa2vq7qtVYtb7XJIBDB",
    "dtFrom": "2026-02-02 00:00:00",
    "dtTo": "2026-02-28 23:59:59"
}
```

| Field    | Source                                                                 |
|----------|------------------------------------------------------------------------|
| `user`   | `ReconServer.userId` from Customer Master Settings                     |
| `secret` | `ReconServer.apiKey` from Customer Master Settings                     |
| `dtFrom` | First day of the billing month, format: `YYYY-MM-DD 00:00:00`         |
| `dtTo`   | Last day of the billing month, format: `YYYY-MM-DD 23:59:59`          |

**Billing month rule:** If billing month is January 2026, then `dtFrom = "2026-01-01 00:00:00"` and `dtTo = "2026-01-31 23:59:59"`.

### Response Body

```json
{
  "success": true,
  "total": 3125877,
  "successCount": 3061605,
  "failed": 64272,
  "notReqToServiceProvider": 0
}
```

| Field                    | Description                                              |
|--------------------------|----------------------------------------------------------|
| `success`                | Whether the API call was successful                      |
| `total`                  | Total SMS messages sent                                  |
| `successCount`           | SMS messages successfully delivered                      |
| `failed`                 | SMS messages that failed                                 |
| `notReqToServiceProvider`| SMS messages not forwarded to the service provider       |

### Response → Frontend Data Mapping

The Recon API response maps to the existing `UsageData.reconDetails` as follows:

| Recon API Response         | Maps To                        |
|----------------------------|--------------------------------|
| `total`                    | `reconTotal`                   |
| `successCount`             | `reconDetails.sent`            |
| `failed`                   | `reconDetails.failed`          |
| `notReqToServiceProvider`  | `reconDetails.withheld`        |

---

## Implementation Plan

### Step 1: Add `userId` to `ReconServer` Interface

**File:** `src/types/index.ts`

```typescript
// CURRENT
export interface ReconServer {
  id: string;
  name: string;
  type: ServiceType;
  apiKey: string;       // maps to "secret"
  apiEndpoint: string;  // maps to API URL
}

// NEW — add userId
export interface ReconServer {
  id: string;
  name: string;
  type: ServiceType;
  userId: string;       // maps to "user" — NEW
  apiKey: string;       // maps to "secret"
  apiEndpoint: string;  // maps to API URL
}
```

**Affected files:**
- `src/types/index.ts` — type definition
- `src/app/customers/page.tsx` — add userId input to Recon Server form section
- `src/components/data-seeder.tsx` — add userId to seed data
- `src/components/invoice-history.tsx` — mock data (if recon server names referenced)

---

### Step 2: Update Customer Form UI

**File:** `src/app/customers/page.tsx`

Add a `userId` input field in the Reconciliation Server configuration section, alongside the existing `name`, `apiKey`, and `apiEndpoint` fields.

---

### Step 3: MongoDB Database Schema

**Tech:** MongoDB (as per ARCHITECTURE.md §11)

#### 3a. Collections

| Collection         | Purpose                                    |
|--------------------|--------------------------------------------|
| `customers`        | Customer master data                       |
| `invoices`         | Generated invoice records (InvoiceHistory) |
| `scheduledJobs`    | Scheduled job records (ScheduledJob)       |

#### 3b. `customers` Collection Schema

```javascript
{
  _id: ObjectId,
  name: String,                          // required
  autocountCustomerId: String,           // required, unique
  services: [String],                    // ["SMS", "EMAIL", "WHATSAPP"]
  providers: [{
    id: String,
    name: String,
    type: String,                        // ServiceType
    apiKey: String,
    apiEndpoint: String
  }],
  reconServers: [{
    id: String,
    name: String,
    type: String,                        // ServiceType
    userId: String,                      // NEW — for Recon API "user" param
    apiKey: String,                      // for Recon API "secret" param
    apiEndpoint: String                  // Recon API URL
  }],
  rates: {
    SMS: Number,
    EMAIL: Number,
    WHATSAPP: Number
  },
  billingMode: String,                   // "MANUAL" | "AUTO_PILOT"
  schedule: {                            // optional, present when AUTO_PILOT
    dayOfMonth: Number,
    time: String,
    retryIntervalMinutes: Number,
    maxRetries: Number
  },
  consolidateInvoice: Boolean,
  discrepancyThreshold: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3c. `invoices` Collection Schema

```javascript
{
  _id: ObjectId,
  customerId: String,                    // ref to customers
  customerName: String,
  billingMonth: String,                  // "2026-01"
  totalAmount: Number,
  status: String,                        // "DRAFT" | "GENERATED" | "SYNCED" | "ERROR"
  autocountRefId: String,               // optional
  billingMode: String,
  schedule: Object,                      // optional, snapshot at generation time
  lineItems: [{
    service: String,
    hasProvider: Boolean,
    reconServerStatus: String,           // "SUCCESS" | "FAILED" | "NOT_CONFIGURED"
    providerStatus: String,
    reconServerName: String,
    providerName: String,
    reconTotal: Number,
    reconDetails: { sent: Number, failed: Number, withheld: Number },
    providerTotal: Number,
    discrepancyPercentage: Number,
    isMismatch: Boolean,
    thresholdUsed: Number,
    billableCount: Number,
    wasOverridden: Boolean,
    overrideReason: String,
    rate: Number,
    totalCharge: Number
  }],
  generatedBy: String,                  // "MANUAL" | "SCHEDULED"
  scheduledJobId: String,               // optional
  syncError: String,                    // optional
  createdAt: Date
}
```

#### 3d. `scheduledJobs` Collection Schema

```javascript
{
  _id: ObjectId,
  customerId: String,
  customerName: String,
  billingMonth: String,
  scheduledAt: Date,
  status: String,                        // "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "RETRYING"
  retryCount: Number,
  maxRetries: Number,
  retryIntervalMinutes: Number,
  nextRetryAt: Date,                     // optional
  invoiceId: String,                     // optional, ref to invoices
  error: String,                         // optional
  completedAt: Date,                     // optional
  createdAt: Date
}
```

---

### Step 4: Backend API Layer (Node.js / Next.js API Routes)

Per ARCHITECTURE.md, the API layer is thin and delegates to domain/infrastructure layers.

#### 4a. Folder Structure (following ARCHITECTURE.md §4)

```
src/
  infrastructure/
    db/
      mongodb.ts              — MongoDB connection singleton
      customerRepository.ts   — CRUD for customers collection
      invoiceRepository.ts    — CRUD for invoices collection
      scheduleRepository.ts   — CRUD for scheduledJobs collection
    external/
      reconClient.ts          — HTTP client for Recon Server API calls
  domain/
    services/
      reconService.ts         — Orchestrates recon data fetching, maps response
      invoiceService.ts       — Invoice generation business logic
    models/
      reconResponse.ts        — Type for Recon API response
```

#### 4b. API Routes to Update

| Route                          | Change                                                |
|--------------------------------|-------------------------------------------------------|
| `GET /api/customers`           | New — fetch customers from MongoDB                    |
| `POST /api/customers`          | New — create customer in MongoDB                      |
| `PUT /api/customers/[id]`      | New — update customer in MongoDB                      |
| `DELETE /api/customers/[id]`   | New — delete customer from MongoDB                    |
| `POST /api/usage`              | Update — call real Recon API instead of mock data     |
| `POST /api/invoices/generate`  | Update — persist invoice to MongoDB                   |
| `GET /api/history`             | Update — fetch invoices from MongoDB                  |

---

### Step 5: Implement Recon API Client

**File:** `src/infrastructure/external/reconClient.ts`

Responsibilities:
- Accept `ReconServer` config + billing month
- Compute `dtFrom` and `dtTo` from billing month
- Make `POST` request to `ReconServer.apiEndpoint`
- Send `{ user: reconServer.userId, secret: reconServer.apiKey, dtFrom, dtTo }`
- Parse and return typed response
- Handle errors (timeout, network, non-200, `success: false`)

---

### Step 6: Implement Recon Service (Domain Layer)

**File:** `src/domain/services/reconService.ts`

Responsibilities:
- Given a customer and billing month, find the appropriate `ReconServer` for each service
- Call the recon client
- Map the response to `UsageData.reconDetails`:
  - `total` → `reconTotal`
  - `successCount` → `reconDetails.sent`
  - `failed` → `reconDetails.failed`
  - `notReqToServiceProvider` → `reconDetails.withheld`
- Return connection status (`SUCCESS` / `FAILED`)

---

### Step 7: Wire Frontend to Real API

Replace mock data generation in the billing page with actual API calls:
- `handleFetchData()` → calls `POST /api/usage` with customer ID + billing month
- The API route calls `reconService` which calls `reconClient`
- Response flows back to the UI and populates `UsageData[]`

---

## Implementation Order

| # | Task                                              | Layer          | Priority |
|---|---------------------------------------------------|----------------|----------|
| 1 | Add `userId` to `ReconServer` interface           | Types          | High     |
| 2 | Update Customer form UI with `userId` field       | UI             | High     |
| 3 | Update seed data with `userId` values             | UI             | High     |
| 4 | Set up MongoDB connection                         | Infrastructure | High     |
| 5 | Create `customers` collection schema + repository | Infrastructure | High     |
| 6 | Create `invoices` collection schema + repository  | Infrastructure | High     |
| 7 | Create `scheduledJobs` schema + repository        | Infrastructure | Medium   |
| 8 | Implement Customer CRUD API routes                | API            | High     |
| 9 | Implement `reconClient` (HTTP client)             | Infrastructure | High     |
| 10| Implement `reconService` (response mapping)       | Domain         | High     |
| 11| Update `POST /api/usage` to use real recon calls  | API            | High     |
| 12| Update `POST /api/invoices/generate` for MongoDB  | API            | High     |
| 13| Update `GET /api/history` for MongoDB             | API            | Medium   |
| 14| Wire frontend stores to real API (React Query)    | UI             | High     |
| 15| Verify end-to-end: Customer → Fetch Data → Invoice| All           | High     |

---

## Environment Variables Required

```env
MONGODB_URI=mongodb://localhost:27017/billing
MONGODB_DB_NAME=billing
```

---

## Constraints

- Follow all rules in CLAUDE.md, ARCHITECTURE.md, CODING_RULES.md, and TASKS.md
- Dependencies flow downward only (UI → API → Domain → Infrastructure interfaces)
- Domain layer must remain framework-agnostic and testable
- No `any` types — strict TypeScript
- Infrastructure errors must not leak into Domain layer
- Secrets (API keys, MongoDB URI) must use environment variables