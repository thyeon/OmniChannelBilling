# Invoice Actions - Preview, Payload, Submit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 action buttons (Preview, Payload, Submit) to each invoice record in Recent Invoices section at /billing/generate-invoice

**Architecture:** New API endpoints for preview/payload/submit actions, reusing existing autocountInvoiceBuilder for payload generation. Frontend adds action buttons with modals for Preview and Payload.

**Tech Stack:** Next.js 14, React, TypeScript, MongoDB, AutoCount API

---

## Chunk 1: Data Model

### Task 1: Add customPayload field to InvoiceHistory type

**Files:**
- Modify: `billing-app/src/types/index.ts:85-102`

- [ ] **Step 1: Add customPayload field to InvoiceHistory interface**

```typescript
// In src/types/index.ts, add to InvoiceHistory interface (after line 101):
customPayload?: string;  // stores user-edited AutoCount payload
```

- [ ] **Step 2: Commit**

```bash
git add billing-app/src/types/index.ts
git commit -m "feat: add customPayload field to InvoiceHistory type"
```

---

## Chunk 2: Backend API Endpoints

### Task 2: Create GET /api/invoices/[id]/preview endpoint

**Files:**
- Create: `billing-app/src/app/api/invoices/[id]/preview/route.ts`
- Reference: `billing-app/src/app/api/invoices/preview/route.ts` (lines 89-107 for format)
- Reference: `billing-app/src/infrastructure/db/invoiceRepository.ts` (findInvoiceById)

- [ ] **Step 1: Create the preview route file**

```typescript
// billing-app/src/app/api/invoices/[id]/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";

interface RouteParams {
  params: { id: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Fetch customer
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Filter line items with billable count > 0
    const lineItems = invoice.lineItems.filter(
      (item) => item.billableCount > 0
    );

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable line items found" },
        { status: 404 }
      );
    }

    // Build AutoCount payload from stored line items
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth: invoice.billingMonth,
      lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    const { master, details } = buildResult.payload;

    // Format response matching existing preview format
    const previewData = details.map((detail, index) => ({
      doc_no: invoice.autocountRefId || `INV-${String(index + 1).padStart(3, "0")}`,
      doc_date: master.docDate,
      debtor_code: master.debtorCode,
      product_code: detail.productCode,
      detail_description: detail.description,
      further_description: detail.furtherDescription || "",
      qty: detail.qty,
      unit_price: detail.unitPrice,
      local_total_cost: detail.localTotalCost || (detail.qty * detail.unitPrice),
    }));

    return NextResponse.json({
      invoiceId: invoice.id,
      billingMonth: invoice.billingMonth,
      customer: invoice.customerName,
      total_rows: previewData.length,
      data: previewData,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test the endpoint manually**

Run: Start dev server and test with curl:
```bash
curl -X GET http://localhost:3000/api/invoices/INVOICE_ID_HERE/preview
```

Expected: JSON response with preview data from stored lineItems

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/app/api/invoices/\[id\]/preview/route.ts
git commit -m "feat: add GET /api/invoices/[id]/preview endpoint"
```

---

### Task 3: Create GET/PUT /api/invoices/[id]/payload endpoint

**Files:**
- Create: `billing-app/src/app/api/invoices/[id]/payload/route.ts`
- Reference: `billing-app/src/infrastructure/db/invoiceRepository.ts` (updateInvoice)
- Reference: `billing-app/src/domain/services/autocountInvoiceBuilder.ts` (buildAutoCountInvoice)

- [ ] **Step 1: Create the payload route file**

```typescript
// billing-app/src/app/api/invoices/[id]/payload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { updateInvoice } from "@/infrastructure/db/invoiceRepository";

interface RouteParams {
  params: { id: string };
}

// GET /api/invoices/[id]/payload
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // If custom payload exists, return it
    if (invoice.customPayload) {
      return NextResponse.json({
        invoiceId: invoice.id,
        billingMonth: invoice.billingMonth,
        customerName: invoice.customerName,
        payload: JSON.parse(invoice.customPayload),
        hasCustomPayload: true,
      });
    }

    // Build payload from stored line items
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth: invoice.billingMonth,
      lineItems: invoice.lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      invoiceId: invoice.id,
      billingMonth: invoice.billingMonth,
      customerName: invoice.customerName,
      payload: buildResult.payload,
      hasCustomPayload: false,
    });
  } catch (error) {
    console.error("Error getting payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/invoices/[id]/payload
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.payload) {
      return NextResponse.json(
        { error: "payload is required" },
        { status: 400 }
      );
    }

    // Validate payload is valid JSON
    let payloadString: string;
    try {
      payloadString = typeof body.payload === 'string'
        ? body.payload
        : JSON.stringify(body.payload, null, 2);
    } catch {
      return NextResponse.json(
        { error: "Invalid payload format" },
        { status: 400 }
      );
    }

    // Save custom payload to invoice
    await updateInvoice(invoice.id, {
      customPayload: payloadString,
    });

    return NextResponse.json({
      success: true,
      message: "Custom payload saved",
    });
  } catch (error) {
    console.error("Error saving payload:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test GET endpoint**

```bash
curl -X GET http://localhost:3000/api/invoices/INVOICE_ID_HERE/payload
```

- [ ] **Step 3: Test PUT endpoint**

```bash
curl -X PUT http://localhost:3000/api/invoices/INVOICE_ID_HERE/payload \
  -H "Content-Type: application/json" \
  -d '{"payload": {"master": {"docNo": "TEST"}}}'
```

- [ ] **Step 4: Commit**

```bash
git add billing-app/src/app/api/invoices/\[id\]/payload/route.ts
git commit -m "feat: add GET/PUT /api/invoices/[id]/payload endpoint"
```

---

### Task 4: Create POST /api/invoices/[id]/submit endpoint

**Files:**
- Create: `billing-app/src/app/api/invoices/[id]/submit/route.ts`
- Reference: `billing-app/src/app/api/invoices/[id]/retry-sync/route.ts` (for AutoCount API call pattern)
- Reference: `billing-app/src/app/api/invoices/generate-auto/route.ts` (for mock mode pattern - lines 170-181)
- Reference: `billing-app/src/infrastructure/external/autocountClient.ts` (createInvoice)

- [ ] **Step 1: Create the submit route file (with mock mode)**

```typescript
// billing-app/src/app/api/invoices/[id]/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findInvoiceById } from "@/infrastructure/db/invoiceRepository";
import { findCustomerById } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { createInvoice } from "@/infrastructure/external/autocountClient";
import { findAccountBookById } from "@/infrastructure/db/autoCountAccountBookRepository";
import { updateInvoice } from "@/infrastructure/db/invoiceRepository";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface RouteParams {
  params: { id: string };
}

interface SubmitRequest {
  useCustomPayload?: boolean;
}

function logToFile(filename: string, content: string): void {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  const filepath = join(logsDir, filename);
  writeFileSync(filepath, content, { flag: "a" });
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const invoice = await findInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Only allow submit for DRAFT status
    if (invoice.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Can only submit invoices with DRAFT status" },
        { status: 400 }
      );
    }

    const body: SubmitRequest = await request.json();
    const useCustomPayload = body.useCustomPayload ?? false;
    const isMockMode = process.env.AUTOCOUNT_MOCK === "true";

    // Fetch customer
    const customer = await findCustomerById(invoice.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Determine which payload to use
    let payload;

    if (useCustomPayload && invoice.customPayload) {
      try {
        payload = JSON.parse(invoice.customPayload);
      } catch {
        await updateInvoice(invoice.id, {
          status: "ERROR",
          syncError: "Invalid custom payload JSON",
        });
        return NextResponse.json({
          success: false,
          status: "ERROR",
          error: "Invalid custom payload JSON",
        });
      }
    } else {
      // Build payload from line items
      const buildResult = await buildAutoCountInvoice({
        customer,
        billingMonth: invoice.billingMonth,
        lineItems: invoice.lineItems,
      });

      if (!buildResult.success || !buildResult.payload) {
        await updateInvoice(invoice.id, {
          status: "ERROR",
          syncError: buildResult.error || "Failed to build invoice payload",
        });
        return NextResponse.json({
          success: false,
          status: "ERROR",
          error: buildResult.error || "Failed to build invoice payload",
        });
      }

      payload = buildResult.payload;
    }

    // Mock mode: log payload and return fake success
    if (isMockMode) {
      const timestamp = Date.now();
      const logEntry = `[${new Date().toISOString()}] SUBMIT INVOICE: ${timestamp}\n${JSON.stringify(payload, null, 2)}\n`;
      logToFile("autocount-mock-invoices.log", logEntry);
      console.log(`[MOCK MODE] Invoice logged to logs/autocount-mock-invoices.log`);

      const mockDocNo = `MOCK-${timestamp}`;

      await updateInvoice(invoice.id, {
        status: "DRAFT",
        autocountRefId: mockDocNo,
        syncError: undefined,
      });

      return NextResponse.json({
        success: true,
        status: "DRAFT",
        docNo: mockDocNo,
        isMock: true,
      });
    }

    // Real mode: get account book and call AutoCount API
    const accountBook = await findAccountBookById(customer.autocountAccountBookId!);
    if (!accountBook) {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: "AutoCount account book not found",
      });
      return NextResponse.json({
        success: false,
        error: "AutoCount account book not found",
      });
    }

    // Call AutoCount API
    const syncResult = await createInvoice(
      {
        accountBookId: accountBook.accountBookId,
        keyId: accountBook.keyId,
        apiKey: accountBook.apiKey,
      },
      payload
    );

    // Update status based on sync result
    if (syncResult.success && syncResult.docNo) {
      await updateInvoice(invoice.id, {
        status: "SYNCED",
        autocountRefId: syncResult.docNo,
        syncError: undefined,
      });
      return NextResponse.json({
        success: true,
        status: "SYNCED",
        docNo: syncResult.docNo,
      });
    } else {
      await updateInvoice(invoice.id, {
        status: "ERROR",
        syncError: syncResult.error || "AutoCount API sync failed",
      });
      return NextResponse.json({
        success: false,
        status: "ERROR",
        error: syncResult.error || "AutoCount API sync failed",
      });
    }
  } catch (error) {
    console.error("Failed to submit invoice:", error);

    // Try to update invoice status to ERROR
    try {
      await updateInvoice(params.id, {
        status: "ERROR",
        syncError: error instanceof Error ? error.message : "Unknown error",
      });
    } catch {
      // Ignore update errors
    }

    return NextResponse.json(
      { success: false, error: "Failed to submit invoice" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test the endpoint**

```bash
curl -X POST http://localhost:3000/api/invoices/INVOICE_ID_HERE/submit \
  -H "Content-Type: application/json" \
  -d '{"useCustomPayload": false}'
```

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/app/api/invoices/\[id\]/submit/route.ts
git commit -m "feat: add POST /api/invoices/[id]/submit endpoint"
```

---

## Chunk 3: Frontend UI

### Task 5: Add action buttons to Recent Invoices table

**Files:**
- Modify: `billing-app/src/app/billing/generate-invoice/page.tsx`
- Reference: `billing-app/src/components/ui/dialog.tsx` (existing Dialog component)

- [ ] **Step 1: Add new imports**

Add to imports section (after existing imports):
```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Eye, FileJson, Send, RotateCcw } from "lucide-react";
```

- [ ] **Step 2: Add state for modals and data**

Add after existing state declarations (around line 73):
```typescript
// Modal states
const [previewModalOpen, setPreviewModalOpen] = useState(false);
const [payloadModalOpen, setPayloadModalOpen] = useState(false);
const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

// Preview data
const [previewData, setPreviewData] = useState<PreviewData | null>(null);
const [payloadData, setPayloadData] = useState<any>(null);
const [isLoadingPreview, setIsLoadingPreview] = useState(false);
const [isLoadingPayload, setIsLoadingPayload] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [payloadJson, setPayloadJson] = useState("");
const [submitError, setSubmitError] = useState("");
```

- [ ] **Step 3: Add handler functions**

Add after handleGenerate function (around line 182):
```typescript
// Preview handlers
async function handlePreviewClick(invoiceId: string) {
  setSelectedInvoiceId(invoiceId);
  setIsLoadingPreview(true);
  setPreviewData(null);

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/preview`);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to load preview");
      return;
    }
    const data = await res.json();
    setPreviewData(data);
    setPreviewModalOpen(true);
  } catch {
    setError("Failed to load preview");
  } finally {
    setIsLoadingPreview(false);
  }
}

// Payload handlers
async function handlePayloadClick(invoiceId: string) {
  setSelectedInvoiceId(invoiceId);
  setIsLoadingPayload(true);
  setPayloadData(null);
  setPayloadJson("");
  setSubmitError("");

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/payload`);
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to load payload");
      return;
    }
    const data = await res.json();
    setPayloadData(data);
    setPayloadJson(JSON.stringify(data.payload, null, 2));
    setPayloadModalOpen(true);
  } catch {
    setError("Failed to load payload");
  } finally {
    setIsLoadingPayload(false);
  }
}

// Save payload handler
async function handleSavePayload() {
  if (!selectedInvoiceId) return;

  setIsSubmitting(true);
  try {
    const res = await fetch(`/api/invoices/${selectedInvoiceId}/payload`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: payloadJson }),
    });

    if (!res.ok) {
      const err = await res.json();
      setSubmitError(err.error || "Failed to save payload");
      return;
    }

    // Reload payload data
    const dataRes = await fetch(`/api/invoices/${selectedInvoiceId}/payload`);
    if (dataRes.ok) {
      const data = await dataRes.json();
      setPayloadData(data);
      setPayloadJson(JSON.stringify(data.payload, null, 2));
    }
  } catch {
    setSubmitError("Failed to save payload");
  } finally {
    setIsSubmitting(false);
  }
}

// Submit handler
async function handleSubmit(useCustomPayload: boolean = false) {
  if (!selectedInvoiceId) return;

  setIsSubmitting(true);
  setSubmitError("");

  try {
    const res = await fetch(`/api/invoices/${selectedInvoiceId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useCustomPayload }),
    });

    const json = await res.json();

    if (!res.ok) {
      setSubmitError(json.error || "Failed to submit");
      return;
    }

    if (json.success) {
      setPayloadModalOpen(false);
      fetchHistory(); // Refresh history
      setResult({
        success: true,
        message: `Invoice submitted successfully`,
        docNo: json.docNo,
      });
    } else {
      setSubmitError(json.error || "Submission failed");
    }
  } catch {
    setSubmitError("Failed to submit invoice");
  } finally {
    setIsSubmitting(false);
  }
}

// Retry handler (for ERROR status)
async function handleRetry(invoiceId: string) {
  setIsSubmitting(true);
  setError("");

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/retry-sync`, {
      method: "POST",
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Retry failed");
      return;
    }

    if (json.success) {
      fetchHistory(); // Refresh history
      setResult({
        success: true,
        message: `Invoice synced successfully`,
        docNo: json.docNo,
      });
    } else {
      setError(json.error || "Retry failed");
    }
  } catch {
    setError("Failed to retry invoice");
  } finally {
    setIsSubmitting(false);
  }
}
```

- [ ] **Step 4: Update the Recent Invoices table to add action buttons**

Replace the TableRow content (around lines 391-404) with:
```typescript
{history.map((record) => (
  <TableRow key={record.id}>
    <TableCell className="font-mono">{record.billingMonth}</TableCell>
    <TableCell>{record.customerName}</TableCell>
    <TableCell>
      <Badge variant={record.status === "GENERATED" || record.status === "DRAFT" ? "default" : record.status === "ERROR" ? "destructive" : "secondary"}>
        {record.status}
      </Badge>
    </TableCell>
    <TableCell className="font-mono">{record.autocountRefId || "-"}</TableCell>
    <TableCell className="text-muted-foreground">
      {new Date(record.createdAt).toLocaleDateString()}
    </TableCell>
    <TableCell>
      <div className="flex gap-1">
        {/* Preview Button - always available */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreviewClick(record.id)}
          title="Preview"
        >
          <Eye className="h-4 w-4" />
        </Button>

        {/* Payload Button - always available */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePayloadClick(record.id)}
          title="Payload"
        >
          <FileJson className="h-4 w-4" />
        </Button>

        {/* Submit/Retry Button - only for DRAFT or ERROR */}
        {record.status === "DRAFT" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedInvoiceId(record.id);
              handlePayloadClick(record.id);
            }}
            title="Submit"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
        {record.status === "ERROR" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRetry(record.id)}
            disabled={isSubmitting}
            title="Retry"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </TableCell>
  </TableRow>
))}
```

- [ ] **Step 5: Add Actions column header**

Add after Date header (around line 387):
```typescript
<TableHead>Actions</TableHead>
```

- [ ] **Step 6: Add Preview and Payload modals**

Add before the final closing `</div>` (around line 411, before the closing Card):
```typescript
{/* Preview Modal */}
<Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Invoice Preview</DialogTitle>
      <DialogDescription>
        {previewData?.billingMonth} - {previewData?.customer}
      </DialogDescription>
    </DialogHeader>
    {isLoadingPreview ? (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ) : previewData ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>DocNo</TableHead>
            <TableHead>DocDate</TableHead>
            <TableHead>DebtorCode</TableHead>
            <TableHead>ProductCode</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>UnitPrice</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewData.data.map((row: any, idx: number) => (
            <TableRow key={idx}>
              <TableCell className="font-mono">{row.doc_no}</TableCell>
              <TableCell>{row.doc_date}</TableCell>
              <TableCell className="font-mono">{row.debtor_code}</TableCell>
              <TableCell className="font-mono">{row.product_code}</TableCell>
              <TableCell className="max-w-[200px] truncate">{row.detail_description}</TableCell>
              <TableCell>{row.qty}</TableCell>
              <TableCell>{row.unit_price?.toFixed(4)}</TableCell>
              <TableCell className="font-medium">{row.local_total_cost?.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ) : (
      <div className="text-center py-4 text-muted-foreground">No preview data</div>
    )}
  </DialogContent>
</Dialog>

{/* Payload Modal */}
<Dialog open={payloadModalOpen} onOpenChange={setPayloadModalOpen}>
  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>AutoCount Payload</DialogTitle>
      <DialogDescription>
        {payloadData?.billingMonth} - {payloadData?.customerName}
        {payloadData?.hasCustomPayload && (
          <span className="ml-2 text-amber-600">(Custom Payload)</span>
        )}
      </DialogDescription>
    </DialogHeader>
    {isLoadingPayload ? (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    ) : (
      <div className="space-y-4">
        <Textarea
          value={payloadJson}
          onChange={(e) => setPayloadJson(e.target.value)}
          className="font-mono text-sm min-h-[300px]"
        />
        {submitError && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {submitError}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleSavePayload}
            disabled={isSubmitting}
          >
            Save
          </Button>
          {selectedInvoiceId && (
            <Button
              onClick={() => handleSubmit(payloadData?.hasCustomPayload)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          )}
        </div>
      </div>
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 7: Test the UI**

Run: Access http://localhost:3000/billing/generate-invoice in browser

Expected:
- Recent Invoices table now has Actions column
- Each row has Preview and Payload buttons
- DRAFT status rows have Submit button
- ERROR status rows have Retry button

- [ ] **Step 8: Commit**

```bash
git add billing-app/src/app/billing/generate-invoice/page.tsx
git commit -m "feat: add Preview, Payload, Submit buttons to Recent Invoices"
```

---

## Acceptance Criteria

1. Each invoice row shows 3 buttons: Preview, Payload, Submit/Retry
2. Buttons are enabled/disabled based on invoice status
3. Preview shows line items in same format as existing Preview feature
4. Payload shows AutoCount JSON format, allows editing
5. Edited payload is saved to database
6. Submit sends to AutoCount and updates status to SYNCED on success
7. Retry shows for ERROR status, works correctly
8. UI is consistent with existing design
9. All API endpoints work correctly
