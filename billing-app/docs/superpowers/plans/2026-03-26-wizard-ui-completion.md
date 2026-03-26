# Customer Wizard UI Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all remaining wizard UI steps (BasicInfo, DataSource) and wire wizard submit to create customer + data sources + product mappings via API.

**Architecture:** The wizard is a 4-step flow (info → dataSource → productMapping → review). BasicInfoStep creates the customer via POST /api/customers and stores the returned customer object (with generated ID) in wizard state. DataSourceStep creates data sources via POST /api/customers/[id]/datasources. ProductMappingStep already creates mappings via POST /api/customer-product-mappings — but its `customerId` prop currently uses a placeholder (`data.customerId || "new-customer"`); this must be updated to use `data.customer?.id` from wizard state. The wizard's WizardData type is extended to hold all step outputs; handleSubmit is wired to POST all data to their respective endpoints.

**Tech Stack:** Next.js App Router, React hooks, shadcn/ui components, TypeScript.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/app/admin/customers/wizard/page.tsx` | Wizard container — extend WizardData, wire step components, implement handleSubmit |
| `src/app/admin/customers/wizard/BasicInfoStep.tsx` | **CREATE** — Form for all Customer fields (name, AutoCount config, billing, schedule) |
| `src/app/admin/customers/wizard/DataSourceStep.tsx` | **CREATE** — Data source list/add/edit/delete UI |
| `src/domain/services/__tests__/wizard.test.ts` | **CREATE** — Tests for wizard submit logic (unit tests mocking API calls) |
| `src/app/admin/customers/wizard/__tests__/BasicInfoStep.test.tsx` | **CREATE** — Tests for BasicInfoStep form validation and rendering |
| `src/app/admin/customers/wizard/__tests__/DataSourceStep.test.tsx` | **CREATE** — Tests for DataSourceStep CRUD operations |

---

## Task 1: BasicInfoStep Component

**Files:**
- Create: `src/app/admin/customers/wizard/BasicInfoStep.tsx`
- Modify: `src/app/admin/customers/wizard/page.tsx:8-18` (extend WizardData)
- Test: `src/app/admin/customers/wizard/__tests__/BasicInfoStep.test.tsx`

### Design Decisions

**Form sections (4 collapsible groups):**
1. **Core Info** — customerName, autocountCustomerId, services (multi-checkbox: SMS/EMAIL/WHATSAPP), rates (per service)
2. **AutoCount Configuration** — autocountAccountBookId, autocountDebtorCode, creditTermOverride, salesLocationOverride, serviceProductOverrides (dynamic rows per service), invoiceDescriptionTemplate, furtherDescriptionTemplate, furtherDescriptionSMSIntl
3. **Billing Settings** — billingMode (toggle: MANUAL / AUTO_PILOT), consolidateInvoice (toggle), discrepancyThreshold (number), billingCycle (select: MONTHLY/QUARTERLY/YEARLY), billingStartMonth (1-12, shown when YEARLY)
4. **Schedule (shown when AUTO_PILOT)** — dayOfMonth (1-31), time (HH:mm), retryIntervalMinutes, maxRetries

**Props:**
```typescript
interface BasicInfoStepProps {
  data: Partial<Customer>;       // Pre-filled for edit mode
  onUpdate: (customer: Partial<Customer>) => void;
  onNext: (createdCustomer: Customer) => void;  // passes back created customer
  onBack: () => void;
}
```

**Behavior:**
- On mount, if `data.id` exists (edit mode), fetch customer via GET /api/customers/[id]
- On "Next", validate required fields, then POST/PUT /api/customers, then call onNext with the saved Customer
- Validation: customerName required, autocountCustomerId required, at least one service selected, rates must be >= 0

### Steps

- [ ] **Step 1: Scaffold BasicInfoStep.tsx**

Create the component file with all form sections using shadcn/ui Accordion for collapsible groups. Include:
- Accordion with 4 items (Core Info, AutoCount Config, Billing Settings, Schedule)
- Service checkboxes (SMS, EMAIL, WHATSAPP) that dynamically show/hide rate inputs
- billingMode toggle that shows/hides schedule fields
- billingCycle select that shows/hides billingStartMonth when "YEARLY"
- onNext calls POST /api/customers, on success calls props.onNext with created customer

```tsx
// Excerpt — service checkboxes
const SERVICE_OPTIONS: ServiceType[] = ["SMS", "EMAIL", "WHATSAPP"];
// ...
{SERVICE_OPTIONS.map((service) => (
  <div key={service} className="flex items-center gap-2">
    <Checkbox
      id={`service-${service}`}
      checked={formData.services.includes(service)}
      onCheckedChange={(checked) => {
        const newServices = checked
          ? [...formData.services, service]
          : formData.services.filter((s) => s !== service);
        setFormData({ ...formData, services: newServices });
      }}
    />
    <Label htmlFor={`service-${service}`}>{service}</Label>
    {formData.services.includes(service) && (
      <Input
        type="number"
        step="0.01"
        min="0"
        className="w-24"
        value={formData.rates[service]}
        onChange={(e) =>
          setFormData({
            ...formData,
            rates: { ...formData.rates, [service]: parseFloat(e.target.value) || 0 },
          })
        }
      />
    )}
  </div>
))}
```

- [ ] **Step 2: Wire BasicInfoStep into page.tsx**

Modify `WizardData` to include the full `customer` object (not just name/id):

```typescript
interface WizardData {
  customer?: Customer;  // Created by BasicInfoStep, used by subsequent steps
  dataSourceId?: string;
  productMappings: CustomerProductMapping[];
}
```

Replace the info step placeholder in page.tsx with `<BasicInfoStep data={data.customer || {}} onUpdate={(c) => setData((p) => ({ ...p, customer: c }))} onNext={(c) => { setData((p) => ({ ...p, customer: c })); handleNext(); }} onBack={handleBack} /> />`.

**Critical**: Also update the ProductMappingStep usage in page.tsx to pass the real customer ID:

```tsx
// OLD (line 147 in current code):
<ProductMappingStep customerId={data.customerId || "new-customer"} ... />

// NEW:
<ProductMappingStep customerId={data.customer?.id || ""} ... />
```

If `customerId` is empty, ProductMappingStep should show a disabled state with a message "Please complete Basic Info step first" rather than calling the API with a placeholder ID.

- [ ] **Step 3: Write BasicInfoStep unit tests**

Test: renders all 4 accordion sections, validates required fields, calls POST on valid submit, handles API errors.

- [ ] **Step 4: Run tests and fix any issues**

Run: `npx vitest src/app/admin/customers/wizard/__tests__/BasicInfoStep.test.tsx --run`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/customers/wizard/BasicInfoStep.tsx src/app/admin/customers/wizard/page.tsx src/app/admin/customers/wizard/__tests__/
git commit -m "feat(wizard): implement BasicInfoStep component with full customer form"
```

---

## Task 2: DataSourceStep Component

**Files:**
- Create: `src/app/admin/customers/wizard/DataSourceStep.tsx`
- Test: `src/app/admin/customers/wizard/__tests__/DataSourceStep.test.tsx`

### Design Decisions

**Props:**
```typescript
interface DataSourceStepProps {
  customerId: string;  // From wizard state (created customer ID)
  onNext: () => void;
  onBack: () => void;
}
```

**UI Pattern:** Mirrors ProductMappingStep — table with grouped rows by serviceType, floating Add button, Add/Edit dialog, Delete confirmation dialog.

**Dialog fields (grouped in grid):**
- Name (text), Type (select: COWAY_API / RECON_SERVER / CUSTOM_REST_API), Service Type (select: SMS / EMAIL / WHATSAPP), API Endpoint (text)
- Auth Type (select: API_KEY / BEARER_TOKEN / BASIC_AUTH / NONE)
- Conditional auth fields: API Key input, Bearer token input, or Username+Password inputs based on authType
- Response Mapping: usageCountPath (text, required), sentPath (text), failedPath (text)
- Advanced section (collapsible): lineItemMappings (dynamic rows), requestTemplate (method + headers), retryPolicy (maxRetries + delays), fallbackValues (counts + useDefaultOnMissing toggle)
- Active toggle

**API calls:**
- GET /api/customers/[customerId]/datasources on mount → populate list
- POST /api/customers/[customerId]/datasources for create
- PUT /api/customers/[customerId]/datasources/[dsId] for update
- DELETE /api/customers/[customerId]/datasources/[dsId] for delete

**Validation:** name, type, serviceType, apiEndpoint, authType, responseMapping.usageCountPath all required.

### Steps

- [ ] **Step 1: Scaffold DataSourceStep.tsx with dialog and table**

Structure: Table (grouped by serviceType) → Add button → Dialog (form with advanced section using Accordion) → Delete dialog. Follow ProductMappingStep patterns exactly.

```tsx
// Excerpt — auth fields based on authType
{formData.authType === "API_KEY" && (
  <div className="space-y-2">
    <Label>API Key</Label>
    <Input type="password" value={formData.authCredentials?.key || ""} onChange={...} />
  </div>
)}
{formData.authType === "BEARER_TOKEN" && (
  <div className="space-y-2">
    <Label>Bearer Token</Label>
    <Input type="password" value={formData.authCredentials?.token || ""} onChange={...} />
  </div>
)}
{formData.authType === "BASIC_AUTH" && (
  <>
    <div className="space-y-2">
      <Label>Username</Label>
      <Input value={formData.authCredentials?.username || ""} onChange={...} />
    </div>
    <div className="space-y-2">
      <Label>Password</Label>
      <Input type="password" value={formData.authCredentials?.password || ""} onChange={...} />
    </div>
  </>
)}
```

- [ ] **Step 2: Wire DataSourceStep into page.tsx**

Replace the dataSource placeholder: `<DataSourceStep customerId={data.customer?.id || ""} onNext={handleNext} onBack={handleBack} />`.

- [ ] **Step 3: Write DataSourceStep unit tests**

Test: renders data sources grouped by serviceType, add/edit/delete flows, validation on required fields, handles empty state.

- [ ] **Step 4: Run tests and fix any issues**

Run: `npx vitest src/app/admin/customers/wizard/__tests__/DataSourceStep.test.tsx --run`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/customers/wizard/DataSourceStep.tsx src/app/admin/customers/wizard/page.tsx src/app/admin/customers/wizard/__tests__/
git commit -m "feat(wizard): implement DataSourceStep component with full CRUD UI"
```

---

## Task 3: Wizard Submit Integration

**Files:**
- Modify: `src/app/admin/customers/wizard/page.tsx:56-63` (handleSubmit)
- Create: `src/domain/services/__tests__/wizard.test.ts`

### Design Decisions

**handleSubmit behavior:**
1. Guard: if no customer exists, show error "Customer not created"
2. Use customer.id from wizard state for all subsequent calls
3. Data sources are already saved during DataSourceStep (immediate POST/PUT on save)
4. Product mappings are already saved during ProductMappingStep (immediate POST/PUT on save)
5. On final submit: show success message, redirect to /admin/customers

**Navigation guard:** Disable "Next" on BasicInfoStep until customer is successfully created (POST returns 201).

**Error handling:** Each step handles its own API errors and shows inline. The wizard submit only needs to verify the customer was created and show a final success state.

### Steps

- [ ] **Step 1: Update handleSubmit in page.tsx**

Add `import { useRouter } from "next/navigation"` and `const router = useRouter()` at the top of the component. Then update handleSubmit:

```typescript
function handleSubmit(): void {
  if (!data.customer?.id) {
    alert("No customer found. Please complete the Basic Info step.");
    return;
  }
  // Data sources and product mappings were already saved during their steps.
  // Final submit just confirms and redirects.
  console.log("Customer creation complete:", data.customer);
  router.push("/admin/customers");
}
```

- [ ] **Step 2: Add navigation guard in BasicInfoStep onNext**

Ensure onNext only fires after POST /api/customers succeeds. Update the callback type to propagate the created customer.

- [ ] **Step 3: Write integration tests for wizard flow**

Test: wizard renders all 4 steps, navigate through steps, BasicInfoStep POST creates customer, DataSourceStep creates data source linked to customer, ProductMappingStep creates mapping, Review shows correct data.

- [ ] **Step 4: Run tests and fix any issues**

Run: `npx vitest src/domain/services/__tests__/wizard.test.ts --run`

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/customers/wizard/page.tsx src/domain/services/__tests__/wizard.test.ts
git commit -m "feat(wizard): wire handleSubmit and integrate all wizard steps"
```

---

## Task 4: Form Validation & UX Polish

**Files:**
- Modify: `src/app/admin/customers/wizard/BasicInfoStep.tsx`
- Modify: `src/app/admin/customers/wizard/DataSourceStep.tsx`

### Items

- [ ] **Step 1: Add field-level validation messages to BasicInfoStep**

Show red error text under fields that fail validation (customerName required, autocountCustomerId required, at least 1 service, rates >= 0, billingStartMonth 1-12).

- [ ] **Step 2: Add field-level validation to DataSourceStep**

Show errors for required fields (name, type, serviceType, apiEndpoint, authType, usageCountPath).

- [ ] **Step 3: Add loading states to BasicInfoStep**

Show spinner on the "Next" button while POST /api/customers is in flight. Disable the button.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/customers/wizard/BasicInfoStep.tsx src/app/admin/customers/wizard/DataSourceStep.tsx
git commit -m "feat(wizard): add form validation and loading states"
```

---

## Task 5: Edit Mode Support

**Files:**
- Modify: `src/app/admin/customers/wizard/page.tsx`

### Design Decisions

Add `?customerId=` query param support to the wizard URL. When opened with a customerId:
1. BasicInfoStep pre-fills from GET /api/customers/[customerId]
2. DataSourceStep pre-fills from GET /api/customers/[customerId]/datasources
3. ProductMappingStep pre-fills from GET /api/customer-product-mappings?customerId=...
4. Submit becomes PUT instead of POST (update instead of create)

### Steps

- [ ] **Step 1: Read customerId from searchParams in page.tsx**

```typescript
export default function CustomerWizardPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const editCustomerId = searchParams.customerId;
  // Load customer data in useEffect if editCustomerId exists
}
```

- [ ] **Step 2: Pass editCustomerId to BasicInfoStep**

BasicInfoStep uses it to pre-fill and switches to PUT for saves.

- [ ] **Step 3: Update Review step to show "Update" button instead of "Submit"**

```typescript
function handleSubmit(): void {
  if (editCustomerId) {
    // PUT /api/customers/[id]
  } else {
    // Already created in BasicInfoStep
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/customers/wizard/page.tsx
git commit -m "feat(wizard): add edit mode support via customerId query param"
```
