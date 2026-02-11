"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Info,
  Loader2,
} from "lucide-react";
import {
  InvoiceHistory,
  InvoiceLineItem,
  InvoiceStatus,
  ConnectionStatus,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

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
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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

function ConnectionDot({ status }: { status: ConnectionStatus }): React.ReactElement {
  switch (status) {
    case "SUCCESS":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Connected
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Failed
        </span>
      );
    case "NOT_CONFIGURED":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          N/A
        </span>
      );
  }
}

function LineItemCard({ item }: { item: InvoiceLineItem }): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Badge variant="outline">{item.service}</Badge>
          {!item.hasProvider && (
            <span className="text-xs text-muted-foreground font-normal">(Recon Only)</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Two-column: Recon Server vs Service Provider */}
        <div className={`grid grid-cols-1 ${item.hasProvider ? "md:grid-cols-2" : ""} gap-4`}>
          {/* Recon Server */}
          <div className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Reconciliation Server
              </h4>
              <ConnectionDot status={item.reconServerStatus} />
            </div>
            <p className="text-sm font-medium">{item.reconServerName}</p>
            {item.reconServerStatus === "SUCCESS" ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="text-lg font-semibold">{item.reconDetails.sent.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Failed</p>
                    <p className="text-lg font-semibold">{item.reconDetails.failed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Withheld</p>
                    <p className="text-lg font-semibold">{item.reconDetails.withheld.toLocaleString()}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Recon Total</span>
                  <span className="font-semibold">{item.reconTotal.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-rose-600 italic">Connection failed — no data retrieved</p>
            )}
          </div>

          {/* Service Provider */}
          {item.hasProvider && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Service Provider
                </h4>
                <ConnectionDot status={item.providerStatus} />
              </div>
              <p className="text-sm font-medium">{item.providerName}</p>
              {item.providerStatus === "SUCCESS" ? (
                <>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Count</p>
                    <p className="text-3xl font-bold">{item.providerTotal.toLocaleString()}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-rose-600 italic">Connection failed — no data retrieved</p>
              )}
            </div>
          )}

          {!item.hasProvider && (
            <div className="hidden" />
          )}
        </div>

        {/* Discrepancy Alert */}
        {!item.hasProvider ? (
          <Alert className="border-muted bg-muted/30">
            <Info className="h-4 w-4 text-muted-foreground" />
            <AlertTitle>Recon Only</AlertTitle>
            <AlertDescription>
              No Service Provider configured. Billing based on Reconciliation Server count.
            </AlertDescription>
          </Alert>
        ) : item.providerStatus === "FAILED" || item.reconServerStatus === "FAILED" ? (
          <Alert className="border-amber-500/50 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Connection Issue</AlertTitle>
            <AlertDescription className="text-amber-700">
              {item.reconServerStatus === "FAILED"
                ? "Recon server connection failed. Billing used provider count."
                : "Provider connection failed. Billing used recon count."}
            </AlertDescription>
          </Alert>
        ) : !item.isMismatch ? (
          <Alert className="border-success/50 bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">Verified</AlertTitle>
            <AlertDescription>
              Counts matched. Discrepancy {item.discrepancyPercentage.toFixed(2)}% is within {item.thresholdUsed}% threshold.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Discrepancy Detected</AlertTitle>
            <AlertDescription>
              Provider count differs from Recon by <strong>{item.discrepancyPercentage.toFixed(2)}%</strong> (threshold: {item.thresholdUsed}%).
            </AlertDescription>
          </Alert>
        )}

        {/* Billing Decision */}
        <div className="rounded-md border p-4 space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Billing Decision
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Billable Count</p>
              <p className="text-lg font-semibold">{item.billableCount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rate</p>
              <p className="text-lg font-semibold">RM {item.rate.toFixed(4)}/unit</p>
            </div>
            <div>
              <p className="text-muted-foreground">Line Total</p>
              <p className="text-lg font-bold">{formatCurrency(item.totalCharge)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Override</p>
              {item.wasOverridden ? (
                <div className="mt-0.5">
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                    Overridden
                  </Badge>
                </div>
              ) : (
                <p className="text-lg font-semibold text-muted-foreground">—</p>
              )}
            </div>
          </div>
          {item.wasOverridden && item.overrideReason && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
              {item.overrideReason}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvoiceDetailPage(): React.ReactElement {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchInvoice = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history/${invoiceId}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const json = await res.json();
      if (res.ok) {
        setInvoice(json.invoice);
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  async function handleRetrySync(): Promise<void> {
    if (!invoice) return;
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/retry-sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Refresh invoice data to reflect updated status
        await fetchInvoice();
      } else {
        alert(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Failed to retry sync: ${(error as Error).message}`);
    } finally {
      setIsRetrying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Link href="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Billing
        </Link>
        <div className="text-center py-16">
          <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Invoice Not Found</h1>
          <p className="text-muted-foreground">
            No invoice found with ID &quot;{invoiceId}&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <Link href="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Billing
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">
            Invoice #{invoice.autocountRefId || invoice.id}
          </h1>
          {getStatusBadge(invoice.status)}
        </div>
      </div>

      {/* Invoice Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Billing Month</p>
              <p className="font-medium">{formatBillingMonth(invoice.billingMonth)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Billing Mode</p>
              <p className="font-medium">
                {invoice.billingMode === "AUTO_PILOT" ? "Auto Pilot" : "Manual"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Cycle Day</p>
              <p className="font-medium">
                {invoice.schedule ? `Day ${invoice.schedule.dayOfMonth} at ${invoice.schedule.time}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Triggered By</p>
              <p className="font-medium">
                {invoice.generatedBy === "SCHEDULED" ? "Scheduled" : "Manual"}
              </p>
            </div>
            {invoice.autocountRefId && (
              <div>
                <p className="text-muted-foreground">AutoCount Ref</p>
                <p className="font-mono font-medium">{invoice.autocountRefId}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Error */}
      {invoice.status === "ERROR" && invoice.syncError && (
        <Alert variant="destructive" className="mb-6">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription className="font-mono text-xs break-all">
            {invoice.syncError}
          </AlertDescription>
        </Alert>
      )}

      {/* Service Breakdown */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Service Breakdown
      </h2>
      <div className="space-y-4 mb-6">
        {invoice.lineItems.map((item: InvoiceLineItem) => (
          <LineItemCard key={item.service} item={item} />
        ))}
      </div>

      {/* Grand Total + Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Grand Total</p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(invoice.totalAmount)}
              </p>
            </div>
            {invoice.status === "ERROR" && (
              <Button variant="outline" onClick={handleRetrySync} disabled={isRetrying}>
                {isRetrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCw className="h-4 w-4" />
                    Retry Sync
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
