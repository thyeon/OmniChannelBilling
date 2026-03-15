"use client";

import { useState, useEffect } from "react";
import { Download, Eye, Loader2, History, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Supported clients
const SUPPORTED_CLIENTS = [
  "AIA Malaysia",
  "Zurich Malaysia",
  "FWD Takaful",
  "Prudential Malaysia",
  "Pizza Hut",
  "Coway (Malaysia) Sdn Bhd",
];

interface PreviewRow {
  doc_no: string;
  doc_date: string;
  sales_location: string;
  sales_agent: string;
  credit_term: string;
  description: string;
  debtor_code: string;
  tax_entity: string;
  address: string;
  detail_description: string;
  further_description: string;
  qty: number;
  unit: number;
  unit_price: number;
  local_total_cost: number;
}

interface PreviewData {
  period: string;
  clients: string[];
  total_rows: number;
  data: PreviewRow[];
}

interface HistoryRecord {
  id: string;
  period: string;
  client_name: string;
  status: string;
  row_count: number;
  file_path?: string;
  exported_at: string;
}

export default function BillingExportPage() {
  const [period, setPeriod] = useState("");
  const [client, setClient] = useState("all");
  const [exportMode, setExportMode] = useState<"download" | "save">("download");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [error, setError] = useState("");

  // Set default period to current month
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setPeriod(`${year}-${month}`);
  }, []);

  // Fetch history on load
  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/billing/history");
      if (res.ok) {
        const data = await res.json();
        setHistory(data.slice(0, 10)); // Show last 10
      }
    } catch (_err) {
      console.error("Failed to fetch history:", _err);
    }
  }

  async function handlePreview() {
    if (!period) {
      setError("Please select a period");
      return;
    }

    setIsLoadingPreview(true);
    setError("");
    setPreviewData(null);

    try {
      const url = `/api/billing/preview?period=${period}&client=${client}`;
      const res = await fetch(url);

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

  async function handleExport() {
    if (!period) {
      setError("Please select a period");
      return;
    }

    setIsExporting(true);
    setError("");

    try {
      if (exportMode === "download") {
        // Download mode - redirect to GET endpoint
        const url = `/api/billing/export?period=${period}&client=${client}`;
        window.open(url, "_blank");
      } else {
        // Save mode - POST request
        const res = await fetch("/api/billing/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period, client }),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Failed to save export");
          return;
        }

        const result = await res.json();
        alert(`Export saved!\n\nFile: ${result.filename}\nRows: ${result.row_count}\n\nDownload: http://localhost:3000${result.download_url}`);
        fetchHistory();
      }
    } catch {
      setError("Failed to export");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">INGLAB Billing Export</h1>
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
          <CardTitle>Export Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select value={client} onValueChange={setClient}>
                <SelectTrigger id="client" className="w-[200px]">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {SUPPORTED_CLIENTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handlePreview}
              disabled={isLoadingPreview || !period}
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

            <Button
              onClick={handleExport}
              disabled={isExporting || !period}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </>
              )}
            </Button>
          </div>

          {/* Export Mode */}
          <div className="mt-4 flex items-center gap-4">
            <Label>Export Mode:</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === "download"}
                  onChange={() => setExportMode("download")}
                />
                Download
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === "save"}
                  onChange={() => setExportMode("save")}
                />
                Save to Server
              </label>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

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
              Period: {previewData.period} | Clients: {previewData.clients.join(", ")}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DocNo</TableHead>
                    <TableHead>DocDate</TableHead>
                    <TableHead>DebtorCode</TableHead>
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
          <CardTitle>Recent Exports</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No export history yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-mono">{record.period}</TableCell>
                    <TableCell>{record.client_name}</TableCell>
                    <TableCell>{record.row_count}</TableCell>
                    <TableCell>
                      <Badge variant={record.status === "success" ? "default" : "destructive"}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(record.exported_at).toLocaleDateString()}
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
