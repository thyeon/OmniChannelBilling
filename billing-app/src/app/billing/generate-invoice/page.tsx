"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle2, XCircle, Eye, History, Settings, Users } from "lucide-react";
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

function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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

export default function GenerateInvoicePage(): React.ReactElement {
  const [billingMonth, setBillingMonth] = useState(formatMonth(new Date()));
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState("");

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

  async function handleGenerate(): Promise<void> {
    if (!billingMonth) return;

    setIsGenerating(true);
    setResult(null);
    setError("");

    try {
      // For v1, we don't send customerId - API defaults to Coway
      const res = await fetch("/api/invoices/generate-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth }),
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
        fetchHistory(); // Refresh history after successful generation
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
        fetchHistory(); // Refresh history after successful generation
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
}
