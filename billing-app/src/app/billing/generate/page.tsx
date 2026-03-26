"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, XCircle, Eye, History, Settings, Users, FileJson, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface GenerateResult {
  success: boolean;
  message: string;
  docNo?: string;
}

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
  invoiceId?: string;
  period?: string;
  billingMonth?: string;
  customer: string;
  customerId: string;
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

interface PayloadData {
  invoiceId: string;
  billingMonth: string;
  customerName: string;
  payload: Record<string, unknown>;
  hasCustomPayload: boolean;
}

export default function GeneratePage(): React.ReactElement {
  const [billingMonth, setBillingMonth] = useState(formatMonth(new Date()));
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState("");

  // Modal states
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [payloadModalOpen, setPayloadModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [payloadData, setPayloadData] = useState<PayloadData | null>(null);
  const [isLoadingPayload, setIsLoadingPayload] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payloadJson, setPayloadJson] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Fetch customers on load
  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers");
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
        }
      } catch (_err) {
        console.error("Failed to fetch customers:", _err);
      } finally {
        setIsLoadingCustomers(false);
      }
    }
    loadCustomers();
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        const invoices = data.invoices || [];
        // Filter to only invoices created via the new generic flow (all invoices for now)
        setHistory(invoices.slice(0, 10));
      }
    } catch (_err) {
      console.error("Failed to fetch history:", _err);
    }
  }

  async function handlePreview(): Promise<void> {
    if (!billingMonth) {
      setError("Please select a billing month");
      return;
    }
    if (!selectedCustomerId) {
      setError("Please select a customer");
      return;
    }

    setIsLoadingPreview(true);
    setError("");
    setPreviewData(null);

    try {
      const res = await fetch("/api/invoices/generate/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth, customerId: selectedCustomerId }),
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

  async function handleGenerate(): Promise<void> {
    if (!billingMonth || !selectedCustomerId) return;

    setIsGenerating(true);
    setResult(null);
    setError("");

    try {
      // Call the dedicated generic generate endpoint (handles full billing flow internally)
      const res = await fetch("/api/invoices/generate/generic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth, customerId: selectedCustomerId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          message: json.error || "Failed to generate invoice",
        });
        return;
      }

      const invoice = json.invoice;
      if (invoice.status === "DRAFT" || invoice.status === "GENERATED") {
        setResult({
          success: true,
          message: "Invoice generated successfully.",
          docNo: invoice.autocountRefId,
        });
        fetchHistory();
      } else if (invoice.status === "ERROR") {
        setResult({
          success: false,
          message: invoice.syncError || "Invoice generation failed",
        });
      } else {
        setResult({
          success: true,
          message: `Invoice generated (status: ${invoice.status})`,
          docNo: invoice.autocountRefId,
        });
        fetchHistory();
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      setResult({
        success: false,
        message: "Network error — failed to generate invoice",
      });
    } finally {
      setIsGenerating(false);
    }
  }

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
        fetchHistory();
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
        fetchHistory();
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

  const selectedCustomerName = customers.find((c) => c.id === selectedCustomerId)?.name || "";

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Invoice Generation</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/admin/customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/billing">
              <History className="h-4 w-4 mr-2" />
              Coway Billing
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
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              {isLoadingCustomers ? (
                <div className="flex items-center h-10 px-3 border rounded-md bg-muted text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading customers...
                </div>
              ) : (
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              disabled={isLoadingPreview || !billingMonth || !selectedCustomerId}
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
              disabled={isGenerating || !billingMonth || !selectedCustomerId}
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
              Preview — {previewData.customer} ({previewData.total_rows} rows)
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
              Period: {previewData.period ?? previewData.billingMonth}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ProductCode</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Further Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>UnitPrice</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.data.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{row.product_code}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.detail_description}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                        {row.further_description}
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

      {/* Recent Invoices */}
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewClick(record.id)}
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePayloadClick(record.id)}
                          title="Payload"
                        >
                          <FileJson className="h-4 w-4" />
                        </Button>
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
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  <TableHead>ProductCode</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Further Description</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>UnitPrice</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.data.map((row: PreviewRow, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{row.product_code}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{row.detail_description}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{row.further_description}</TableCell>
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
    </div>
  );
}
