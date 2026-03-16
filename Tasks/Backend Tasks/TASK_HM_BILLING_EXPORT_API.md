# INGLAB Billing Export API - Technical Specification

**Project:** INGLAB Partner Billing Export Integration
**Date:** 2026-03-13
**Status:** Draft
**Branch:** hmIntegration

---

## 1. Executive Summary

Build an API equivalent to the `inglab-billing-export` skill that:
1. Fetches billing data from INGLAB Partner API
2. Transforms data to AutoCount CSV format
3. Stores configuration (Client Mapping, Field Defaults) in MongoDB
4. Provides CRUD UI for configuration management

**Constraint:** Must not impact existing backend code.

---

## 2. Supported Clients

Based on updated skills file:
- AIA Malaysia
- Zurich Malaysia
- FWD Takaful
- Prudential Malaysia
- Pizza Hut

## 3. Architecture

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB (existing) |
| Auth | NextAuth (existing) |
| UI | React + Tailwind + Radix UI |
| State | Zustand |

### 3.1 Data Model

#### Collection: `billing_clients`
```typescript
{
  _id: ObjectId,
  source_client_name: string,    // e.g., "AIA Malaysia", "Zurich Malaysia"
  debtor_code: string,            // e.g., "300-0001"
  tax_entity: string,            // e.g., "TIN:C20395547010"
  address: string,
  is_active: boolean,
  created_at: Date,
  updated_at: Date
}
```

#### Collection: `billing_defaults`
```typescript
{
  _id: ObjectId,
  field_name: string,            // e.g., "sales_location", "credit_term"
  field_value: string,           // e.g., "HQ", "Net 30 days"
  is_system: boolean,            // true for non-editable system fields
  created_at: Date,
  updated_at: Date
}
```

#### Collection: `billing_export_history`
```typescript
{
  _id: ObjectId,
  period: string,                // e.g., "2026-01"
  client_name: string,          // "AIA Malaysia", "Zurich Malaysia"
  status: string,                // "success", "failed"
  row_count: number,
  file_path: string,
  error_message?: string,
  exported_at: Date
}
```

### 3.2 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/billing/clients` | List all client mappings |
| POST | `/api/billing/clients` | Create new client mapping |
| PUT | `/api/billing/clients/[id]` | Update client mapping |
| DELETE | `/api/billing/clients/[id]` | Delete client mapping |
| GET | `/api/billing/defaults` | List all default field values |
| PUT | `/api/billing/defaults/[field_name]` | Update default value |
| GET | `/api/billing/preview` | Preview export data (JSON) |
| GET | `/api/billing/export` | Generate CSV (download mode) |
| POST | `/api/billing/export` | Generate CSV (save mode) |
| GET | `/api/billing/history` | List export history |

### 3.3 UI Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/billing` | Overview + export form |
| Client Mapping | `/billing/clients` | CRUD for client mappings |
| Field Defaults | `/billing/settings` | CRUD for default fields |
| Export History | `/billing/history` | List of past exports |

---

## 4. UI/UX Design

### 4.0 Preview Feature

**Preview Button:** Before exporting, user can click "Preview" to see the data that will be generated.

**Preview API Response (JSON):**
```json
{
  "period": "2026-01",
  "clients": ["AIA Malaysia", "Zurich Malaysia"],
  "total_rows": 117,
  "data": [
    {
      "doc_no": "<<New>>",
      "doc_date": "13/03/2026",
      "sales_location": "HQ",
      "sales_agent": "Darren Lim",
      "credit_term": "Net 30 days",
      "description": "INVOICE",
      "debtor_code": "300-0001",
      "tax_entity": "TIN:C20395547010",
      "address": "Level 19 Menara AIA...",
      "detail_description": "WhatsApp Business Fee - Marketing",
      "further_description": "• Pay-per-use : USD 0.0964...",
      "qty": 139,
      "unit": 139,
      "unit_price": 0.3469,
      "local_total_cost": 48.22
    }
  ]
}
```

### 4.1 Billing Dashboard (`/billing`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  INGLAB Billing Export                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │ Period              │  │ Client              │                   │
│  │ [2026-01 ▼]        │  │ [All Clients ▼]    │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ [Preview]                    [Export CSV ▼]                  │  │
│  │         Export Mode: ( ) Download   ( ) Save to Server        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Preview Data (117 rows)                            [Toggle] │  │
│  │ ───────────────────────────────────────────────────────────│  │
│  │ DocNo | DebtorCode | Description           | Qty | Amount   │  │
│  │ ───────────────────────────────────────────────────────────│  │
│  │ <<New>> | 300-0001 | WhatsApp Business Fee... | 139 | 48.22 │  │
│  │       | 300-0001 | WhatsApp Business Fee... |  50 | 17.35  │  │
│  │ <<New>> | 300-H002 | WhatsApp Business Fee... |   0 |  0   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Recent Exports                                                │  │
│  │ ───────────────────────────────────────────────────────────│  │
│  │ 2026-01 | AIA Malaysia | 102 rows | Success | 13/03/2026   │  │
│  │ 2026-01 | Zurich Malaysia | 15 rows | Success | 13/03/2026 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Client Mapping Page (`/billing/clients`)

```
┌─────────────────────────────────────────────────────────────┐
│  Client Mapping Management                     [+ Add New] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Source Name      │ DebtorCode │ TaxEntity   │ Actions│    │
│  │ ───────────────────────────────────────────────────│    │
│  │ AIA Malaysia    │ 300-0001   │ TIN:C203... │ ✏️ 🗑️ │    │
│  │ Zurich Malaysia  │ 300-H002   │ TIN:C251... │ ✏️ 🗑️ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

[Modal - Add/Edit Client]
┌─────────────────────────────────────────────────────────────┐
│  Add/Edit Client Mapping                                    │
├─────────────────────────────────────────────────────────────┤
│  Source Client Name:  [________________________]            │
│  Debtor Code:        [________________________]            │
│  Tax Entity:         [________________________]            │
│  Address:           [________________________]            │
│                     [________________________]            │
│                                                              │
│              [Cancel]        [Save]                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Field Defaults Page (`/billing/settings`)

```
┌─────────────────────────────────────────────────────────────┐
│  Field Default Settings                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Field              │ Value              │ Editable │    │
│  │ ───────────────────────────────────────────────────│    │
│  │ SalesLocation     │ HQ                 │    ✏️    │    │
│  │ SalesAgent        │ Darren Lim          │    ✏️    │    │
│  │ CreditTerm        │ Net 30 days        │    ✏️    │    │
│  │ ProductCode       │ MODE-WA-API        │    ✏️    │    │
│  │ AccNo             │ 500-0000           │    ✏️    │    │
│  │ ClassificationCode│ '022               │    ✏️    │    │
│  │ TaxCode           │ SV-8               │    ✏️    │    │
│  │ InclusiveTax      │ FALSE              │    ✏️    │    │
│  │ SubmitEInvoice    │ FALSE              │    ✏️    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Field Mapping (from skill)

### 5.1 Configurable Fields (stored in DB)

| AutoCount Column | Skill Default | DB Field |
|----------------|---------------|----------|
| SalesLocation | HQ | sales_location |
| SalesAgent | Darren Lim | sales_agent |
| CreditTerm | Net 30 days | credit_term |
| ProductCode | MODE-WA-API | product_code |
| AccNo | 500-0000 | acc_no |
| ClassificationCode | '022 | classification_code |
| TaxCode | SV-8 | tax_code |
| InclusiveTax | FALSE | inclusive_tax |
| SubmitEInvoice | FALSE | submit_e_invoice |

### 5.2 Client Mapping (stored in DB)

| Field | Source |
|-------|--------|
| DebtorCode | billing_clients.debtor_code |
| TaxEntity | billing_clients.tax_entity |
| Address | billing_clients.address |

### 5.3 Dynamic Fields (from API)

| AutoCount Column | Source |
|-----------------|--------|
| DocNo | "<<New>>" (first line item) |
| DocDate | Current date |
| TaxDate | Current date |
| Description | "INVOICE" |
| DetailDescription | line_items.description |
| FurtherDescription | line_items.description_detail |
| Qty | line_items.qty (null → 0) |
| Unit | line_items.qty (null → 0) |
| UnitPrice | line_items.unit_price |
| LocalTotalCost | qty × unit_price |

---

## 6. API Integration

### 6.1 External API (INGLAB Partner)

| Item | Value |
|------|-------|
| Base URL | https://partner-billing-inglab.hypedmind.ai/partner-api/INGLAB |
| Token | From .env (AUTOCOUNT_API_TOKEN) |

### 6.2 Endpoints Called

```
GET {BASE_URL}/clients
GET {BASE_URL}/billable?period={YYYY-MM}
```

---

## 7. Acceptance Criteria

### 7.1 Client Mapping CRUD
- [ ] Can view list of all client mappings
- [ ] Can add new client mapping with validation
- [ ] Can edit existing client mapping
- [ ] Can delete client mapping (soft delete - is_active: false)
- [ ] Client dropdown populated from DB

### 7.2 Field Defaults CRUD
- [ ] Can view all default field values
- [ ] Can edit editable fields
- [ ] System fields (DocNo, Description) are read-only
- [ ] Changes persist to MongoDB

### 7.3 Export Functionality
- [ ] Can select period (YYYY-MM)
- [ ] Can select client (All or specific)
- [ ] Can choose download or save mode
- [ ] **Preview:** Click "Preview" to see JSON data before export
- [ ] **Preview Display:** Show preview table with key columns
- [ ] **Preview Row Count:** Display total row count in preview
- [ ] Download returns CSV file
- [ ] Save mode returns file path
- [ ] Exports only configured clients (AIA, Zurich, FWD Takaful, Prudential, Pizza Hut)
- [ ] Handles null qty as 0

### 7.4 History
- [ ] View past export records
- [ ] See status, row count, timestamp

### 7.5 Non-Functional
- [ ] No impact on existing /api routes
- [ ] Existing authentication required
- [ ] Responsive UI on mobile

---

## 8. File Structure

```
billing-app/
├── src/
│   ├── app/
│   │   ├── billing/
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── clients/
│   │   │   │   └── page.tsx        # Client mapping CRUD
│   │   │   ├── settings/
│   │   │   │   └── page.tsx        # Field defaults
│   │   │   └── history/
│   │   │       └── page.tsx        # Export history
│   │   └── api/
│   │       └── billing/
│   │           ├── clients/
│   │           │   ├── route.ts
│   │           │   └── [id]/route.ts
│   │           ├── defaults/
│   │           │   └── route.ts
│   │           ├── export/
│   │           │   └── route.ts
│   │           └── history/
│   │               └── route.ts
│   ├── domain/
│   │   ├── models/
│   │   │   ├── billingClient.ts
│   │   │   ├── billingDefaults.ts
│   │   │   └── billingExportHistory.ts
│   │   └── services/
│   │       └── billingExportService.ts
│   └── infrastructure/
│       └── db/
│           ├── billingClientRepository.ts
│           ├── billingDefaultsRepository.ts
│           └── billingExportHistoryRepository.ts
└── .env.local
    # Add: AUTOCOUNT_API_TOKEN
```

---

## 9. Constraints & Notes

1. **No Impact to Existing Code**: All new code goes under `/billing` routes and `/api/billing` endpoints
2. **Authentication**: Use existing NextAuth session
3. **MongoDB Collections**: Create new collections, don't modify existing ones
4. **Environment Variables**:
   - `AUTOCOUNT_API_TOKEN` - Partner API token
   - `AUTOCOUNT_BASE_URL` - Partner API base URL
5. **Backward Compatibility**: The inglab-billing-export skill remains the source of truth for business rules
