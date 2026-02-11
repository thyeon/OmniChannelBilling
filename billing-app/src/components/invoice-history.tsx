"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, RotateCw, Eye } from "lucide-react";
import { InvoiceHistory, InvoiceStatus } from "@/types";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

type StatusFilter = "ALL" | InvoiceStatus;

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatBillingMonth(billingMonth: string): string {
  const [year, month] = billingMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return `RM ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getStatusBadge(status: InvoiceStatus): React.ReactElement {
  switch (status) {
    case "SYNCED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          Synced
        </Badge>
      );
    case "ERROR":
      return (
        <Badge className="bg-rose-600 text-white hover:bg-rose-600">
          Error
        </Badge>
      );
    case "DRAFT":
      return (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">
          Draft
        </Badge>
      );
    case "GENERATED":
      return (
        <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">
          Generated
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function InvoiceHistoryPanel(): React.ReactElement {
  const [invoices, setInvoices] = useState<InvoiceHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      if (res.ok) {
        setInvoices(json.invoices ?? []);
      } else {
        console.error("Failed to fetch invoices:", json.error);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch = invoice.customerName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || invoice.status === statusFilter;

      let matchesDate = true;
      if (dateFrom) {
        matchesDate =
          matchesDate && new Date(invoice.createdAt) >= new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        matchesDate =
          matchesDate && new Date(invoice.createdAt) <= toDate;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchQuery, statusFilter, dateFrom, dateTo]);

  async function handleRetrySync(invoiceId: string): Promise<void> {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/retry-sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sync successful! Invoice synced to AutoCount with docNo: ${data.docNo}`);
        await fetchInvoices();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Failed to retry sync: ${(error as Error).message}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search Customer</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by customer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger id="statusFilter" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="GENERATED">Generated</SelectItem>
                  <SelectItem value="SYNCED">Synced</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Billing Month</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead>AutoCount Ref ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  No invoices found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                  <TableCell className="font-medium">
                    {invoice.customerName}
                  </TableCell>
                  <TableCell>
                    {formatBillingMonth(invoice.billingMonth)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(invoice.totalAmount)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {invoice.status === "SYNCED" && invoice.autocountRefId
                      ? invoice.autocountRefId
                      : "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/history/${invoice.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {invoice.status === "ERROR" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRetrySync(invoice.id)}
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <RotateCw className="h-4 w-4" />
                          Retry Sync
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
