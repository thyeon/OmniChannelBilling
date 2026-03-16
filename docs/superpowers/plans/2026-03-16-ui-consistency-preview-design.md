# UI Consistency & Preview Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor /billing/generate-invoice to match /billing-export layout and add preview feature for invoice line items

**Architecture:** This is a UI refactor and new endpoint. The preview endpoint reuses the existing autocountInvoiceBuilder.ts logic to return data without calling AutoCount API. The frontend follows the established pattern from /billing-export page.

**Tech Stack:** Next.js 14, React, TypeScript, MongoDB, AutoCount API

---

## Chunk 1: Backend - Preview API Endpoint

### Task 1: Create /api/invoices/preview endpoint

**Files:**
- Create: `billing-app/src/app/api/invoices/preview/route.ts`
- Reference: `billing-app/src/app/api/invoices/generate-auto/route.ts`
- Reference: `billing-app/src/domain/services/autocountInvoiceBuilder.ts`

- [ ] **Step 1: Create the preview route file**

```typescript
// billing-app/src/app/api/invoices/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findAllCustomers } from "@/infrastructure/db/customerRepository";
import { buildAutoCountInvoice } from "@/domain/services/autocountInvoiceBuilder";
import { fetchCowayBillableData } from "@/domain/services/cowayBillingService";
import { Customer } from "@/types";

const COWAY_CUSTOMER_NAME = "Coway (Malaysia) Sdn Bhd";

interface PreviewRequest {
  billingMonth: string;
  customerId?: string;
}

function isValidBillingMonth(month: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(month);
}

export async function POST(request: NextRequest) {
  try {
    const body: PreviewRequest = await request.json();

    if (!body.billingMonth || !isValidBillingMonth(body.billingMonth)) {
      return NextResponse.json(
        { error: "billingMonth must be in YYYY-MM format" },
        { status: 400 }
      );
    }

    const billingMonth = body.billingMonth;
    const customerName = COWAY_CUSTOMER_NAME;

    // Fetch customer
    const customers = await findAllCustomers();
    const customer = customers.find((c) => c.name === customerName) || null;

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Validate customer has AutoCount configuration
    if (!customer.autocountAccountBookId || !customer.autocountDebtorCode) {
      return NextResponse.json(
        { error: "Customer is not configured for AutoCount billing" },
        { status: 400 }
      );
    }

    // Fetch billable data
    const billableResult = await fetchCowayBillableData(billingMonth);

    if (!billableResult.customer) {
      return NextResponse.json(
        { error: "No billing data found for the specified billing month" },
        { status: 404 }
      );
    }

    // Filter out line items with zero billable count
    const lineItems = billableResult.lineItems.filter(
      (item) => item.billableCount > 0
    );

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "No billable data found for the specified billing month" },
        { status: 404 }
      );
    }

    // Build AutoCount payload (same as generate but without calling API)
    const buildResult = await buildAutoCountInvoice({
      customer,
      billingMonth,
      lineItems,
    });

    if (!buildResult.success || !buildResult.payload) {
      return NextResponse.json(
        { error: buildResult.error || "Failed to build invoice payload" },
        { status: 500 }
      );
    }

    const { master, details } = buildResult.payload;

    // Format response matching /billing-export pattern
    const previewData = details.map((detail, index) => ({
      doc_no: `PREVIEW-${String(index + 1).padStart(3, "0")}`,
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
      period: billingMonth,
      customer: customerName,
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

- [ ] **Step 2: Test the preview endpoint manually**

Run: Start dev server and test with curl:
```bash
curl -X POST http://localhost:3000/api/invoices/preview \
  -H "Content-Type: application/json" \
  -d '{"billingMonth": "2026-03"}'
```

Expected: JSON response with preview data

- [ ] **Step 3: Commit**

```bash
git add billing-app/src/app/api/invoices/preview/route.ts
git commit -m "feat: add /api/invoices/preview endpoint for invoice line items"
```

---

## Chunk 2: Frontend - Page Refactor

### Task 2: Refactor /billing/generate-invoice page to match /billing-export layout

**Files:**
- Modify: `billing-app/src/app/billing/generate-invoice/page.tsx`
- Reference: `billing-app/src/app/billing-export/page.tsx`

- [ ] **Step 1: Update imports and add state variables**

Add imports:
```typescript
import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, XCircle, Eye, History, Settings, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
```

Add interfaces (after imports):
```typescript
interface PreviewRow {
  doc_no: string;
  doc_date: string;
  debtor_code: string;
  product_code: string;
  detail_description: string;
  further_description: string;
  qty: number;
  unit_price: number;
  local_total_cost: number;
}

interface PreviewData {
  period: string;
  customer: string;
  total_rows: number;
  data: PreviewRow[];
}

interface HistoryRecord {
  id: string;
  billingMonth: string;
  customerName: string;
  status: string;
  autocountRefId?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add state variables**

Replace existing state with:
```typescript
const [billingMonth, setBillingMonth] = useState(formatMonth(new Date()));
const [isLoadingPreview, setIsLoadingPreview] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);
const [result, setResult] = useState<GenerateResult | null>(null);
const [previewData, setPreviewData] = useState<PreviewData | null>(null);
const [showPreview, setShowPreview] = useState(false);
const [history, setHistory] = useState<HistoryRecord[]>([]);
const [error, setError] = useState("");
```

- [ ] **Step 3: Add useEffect for fetching history**

Add after existing useEffect:
```typescript
// Fetch history on load
useEffect(() => {
  fetchHistory();
}, []);

async function fetchHistory() {
  try {
    const res = await fetch("/api/history");
    if (res.ok) {
      const data = await res.json();
      // Access the invoices array from the response
      const invoices = data.invoices || [];
      setHistory(invoices.slice(0, 10)); // Show last 10
    }
  } catch (_err) {
    console.error("Failed to fetch history:", _err);
  }
}
```

- [ ] **Step 4: Add handlePreview function**

Add after handleGenerate:
```typescript
async function handlePreview(): Promise<void> {
  if (!billingMonth) {
    setError("Please select a billing month");
    return;
  }

  setIsLoadingPreview(true);
  setError("");
  setPreviewData(null);

  try {
    const res = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingMonth }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to generate preview");
      return;
    }

    const data = await res.json();
    setPreviewData(data);
    setShowPreview(true);
  } catch {
    setError("Failed to generate preview");
  } finally {
    setIsLoadingPreview(false);
  }
}
```

- [ ] **Step 5: Update handleGenerate to refresh history**

Update handleGenerate to call fetchHistory() after successful generation:
```typescript
// After successful generation
if (invoice.status === "DRAFT" || invoice.status === "GENERATED") {
  setResult({
    success: true,
    message: "Invoice generated successfully.",
    docNo: invoice.autocountRefId,
  });
  fetchHistory(); // Add this line
}
```

- [ ] **Step 6: Replace the return JSX**

Replace the entire return statement with:
```tsx
return (
  <div className="container mx-auto py-8 px-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-foreground">AutoCount Invoice Generation</h1>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <a href="/billing-export/clients">
            <Users className="h-4 w-4 mr-2" />
            Clients
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/billing-export/settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/billing-export/history">
            <History className="h-4 w-4 mr-2" />
            History
          </a>
        </Button>
      </div>
    </div>

    {/* Control Panel */}
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invoice Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          {/* Customer Selection (read-only for v1) */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Input
              id="customer"
              value="Coway (Malaysia) Sdn Bhd"
              disabled
              className="bg-muted w-[200px]"
            />
          </div>

          {/* Billing Month */}
          <div className="space-y-2">
            <Label htmlFor="billingMonth">Billing Month</Label>
            <Input
              id="billingMonth"
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="w-[180px]"
            />
          </div>

          {/* Preview Button */}
          <Button
            onClick={handlePreview}
            disabled={isLoadingPreview || !billingMonth}
            variant="outline"
          >
            {isLoadingPreview ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !billingMonth}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Invoice
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>

    {/* Result Alert */}
    {result && (
      <Alert variant={result.success ? "default" : "destructive"} className="mb-6">
        {result.success ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertTitle>{result.success ? "Success" : "Error"}</AlertTitle>
        <AlertDescription>
          {result.message}
          {result.docNo && (
            <span className="block mt-1 font-mono">
              AutoCount Doc No: {result.docNo}
            </span>
          )}
        </AlertDescription>
      </Alert>
    )}

    {/* Preview Section */}
    {showPreview && previewData && (
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Preview Data ({previewData.total_rows} rows)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(false)}
          >
            Hide
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            Period: {previewData.period} | Customer: {previewData.customer}
          </div>
          <div className="overflow-x-auto">
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
                {previewData.data.slice(0, 50).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{row.doc_no}</TableCell>
                    <TableCell>{row.doc_date}</TableCell>
                    <TableCell className="font-mono">{row.debtor_code}</TableCell>
                    <TableCell className="font-mono">{row.product_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {row.detail_description}
                    </TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>{row.unit_price.toFixed(4)}</TableCell>
                    <TableCell className="font-medium">
                      {row.local_total_cost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {previewData.total_rows > 50 && (
              <div className="text-center py-2 text-muted-foreground">
                ... and {previewData.total_rows - 50} more rows
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Recent Exports */}
    <Card>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No invoice history yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>DocNo</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono">{record.billingMonth}</TableCell>
                  <TableCell>{record.customerName}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === "GENERATED" || record.status === "DRAFT" ? "default" : "destructive"}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{record.autocountRefId || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  </div>
);
```

- [ ] **Step 7: Test the UI**

Run: Access http://localhost:3000/billing/generate-invoice in browser

Expected:
- Header with navigation buttons (Clients, Settings, History)
- Control panel with Customer, Billing Month, Preview, Generate buttons
- Preview section shows table with invoice line items
- Recent Invoices section shows history table

- [ ] **Step 8: Commit**

```bash
git add billing-app/src/app/billing/generate-invoice/page.tsx
git commit -m "refactor: update /billing/generate-invoice to match /billing-export layout with preview feature"
```

---

## Acceptance Criteria

1. `/billing/generate-invoice` has header with navigation buttons - Clients, Settings, History
2. Control panel has Customer (read-only), Billing Month, Preview, and Generate buttons
3. Preview button shows table with invoice line items
4. Preview table shows all requested columns: doc_no, doc_date, debtor_code, product_code, detail_description, further_description, qty, unit_price, local_total_cost
5. Recent Invoices section displays history from /api/history
6. `/api/invoices/preview` endpoint works correctly
7. UI styling matches `/billing-export` exactly
