"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  Info,
  Clock,
  RotateCw,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { useCustomerStore } from "@/store/useCustomerStore";
import { useBillingStore } from "@/store/useBillingStore";
import { useScheduleStore } from "@/store/useScheduleStore";
import { useScheduler } from "@/hooks/useScheduler";
import { InvoiceHistoryPanel } from "@/components/invoice-history";
import { UsageData, ServiceType, ScheduleJobStatus, ConnectionStatus, InvoiceLineItem } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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


export default function BillingPage(): React.ReactElement {
  const { customers, selectedCustomer, setSelectedCustomer } =
    useCustomerStore();
  const {
    billingMonth,
    usageData,
    isLoading,
    setBillingMonth,
    setUsageData,
    updateBillableCount,
    setLoading,
    reset,
  } = useBillingStore();

  const [forceProviderCount, setForceProviderCount] = useState<
    Record<ServiceType, boolean>
  >({ SMS: false, EMAIL: false, WHATSAPP: false });

  const grandTotal = useMemo(
    () => usageData.reduce((sum, item) => sum + item.totalCharge, 0),
    [usageData]
  );

  function handleCustomerSelect(customerId: string): void {
    const customer = customers.find((c) => c.id === customerId) ?? null;
    setSelectedCustomer(customer);
    reset();
    setForceProviderCount({ SMS: false, EMAIL: false, WHATSAPP: false });
  }

  function handleMonthChange(value: string): void {
    const [year, month] = value.split("-").map(Number);
    setBillingMonth(new Date(year, month - 1, 1));
  }

  async function handleFetchData(): Promise<void> {
    if (!selectedCustomer) return;

    setLoading(true);
    setForceProviderCount({ SMS: false, EMAIL: false, WHATSAPP: false });

    try {
      const monthStr = formatMonth(billingMonth);
      const res = await fetch(
        `/api/usage?customerId=${selectedCustomer.id}&billingMonth=${monthStr}`
      );
      const json = await res.json();

      if (!res.ok) {
        console.error("Usage API error:", json.error);
        setUsageData([]);
        return;
      }

      // Map API response to UsageData[]
      const mapped: UsageData[] = json.services.map(
        (svc: {
          service: ServiceType;
          reconServerName: string;
          reconServerStatus: string;
          recon: { sent: number; failed: number; withheld: number };
          reconTotal: number;
          provider: { total: number };
          discrepancy: {
            isMismatch: boolean;
            diffPercentage: number;
          };
          error?: string;
        }) => {
          const hasProvider = selectedCustomer.providers.some(
            (p) => p.type === svc.service
          );
          const provider = selectedCustomer.providers.find(
            (p) => p.type === svc.service
          );
          const rate = selectedCustomer.rates[svc.service];
          const billableCount = svc.discrepancy.isMismatch
            ? svc.reconTotal
            : svc.provider.total;

          return {
            service: svc.service,
            hasProvider,
            reconServerStatus: svc.reconServerStatus as ConnectionStatus,
            providerStatus: hasProvider ? "SUCCESS" as ConnectionStatus : "NOT_CONFIGURED" as ConnectionStatus,
            reconServerName: svc.reconServerName,
            providerName: provider?.name || "",
            reconTotal: svc.reconTotal,
            providerTotal: svc.provider.total,
            reconDetails: svc.recon,
            billableCount,
            rate,
            totalCharge: billableCount * rate,
            isMismatch: svc.discrepancy.isMismatch,
            discrepancyPercentage: svc.discrepancy.diffPercentage,
            thresholdUsed: selectedCustomer.discrepancyThreshold,
          } as UsageData;
        }
      );

      setUsageData(mapped);
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
      setUsageData([]);
    } finally {
      setLoading(false);
    }
  }

  function handleForceProviderToggle(
    service: ServiceType,
    checked: boolean,
    item: UsageData
  ): void {
    setForceProviderCount((prev) => ({ ...prev, [service]: checked }));
    const newCount = checked ? item.providerTotal : item.reconTotal;
    updateBillableCount(service, newCount);
  }

  function handleBillableCountChange(
    service: ServiceType,
    value: string
  ): void {
    const count = parseInt(value, 10) || 0;
    updateBillableCount(service, count);
  }

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  async function handleGenerateInvoice(): Promise<void> {
    if (!selectedCustomer || usageData.length === 0) return;

    setIsGenerating(true);
    setGenerateResult(null);

    try {
      const lineItems: InvoiceLineItem[] = usageData.map((item) => ({
        service: item.service,
        hasProvider: item.hasProvider,
        reconServerStatus: item.reconServerStatus,
        providerStatus: item.providerStatus,
        reconServerName: item.reconServerName,
        providerName: item.providerName,
        reconTotal: item.reconTotal,
        reconDetails: item.reconDetails,
        providerTotal: item.providerTotal,
        discrepancyPercentage: item.discrepancyPercentage,
        isMismatch: item.isMismatch,
        thresholdUsed: item.thresholdUsed,
        billableCount: item.billableCount,
        wasOverridden: false,
        rate: item.rate,
        totalCharge: item.totalCharge,
      }));

      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          billingMonth: formatMonth(billingMonth),
          lineItems,
          generatedBy: "MANUAL",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setGenerateResult({
          success: false,
          message: json.error || "Failed to generate invoice",
        });
        return;
      }

      const invoice = json.invoice;
      if (invoice.status === "SYNCED") {
        setGenerateResult({
          success: true,
          message: `Invoice synced to AutoCount: ${invoice.autocountRefId}`,
        });
      } else if (invoice.status === "ERROR") {
        setGenerateResult({
          success: false,
          message: invoice.syncError || "Invoice generation failed",
        });
      } else {
        setGenerateResult({
          success: true,
          message: `Invoice generated (status: ${invoice.status})`,
        });
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      setGenerateResult({
        success: false,
        message: "Network error — failed to generate invoice",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  const isAutoPilot = selectedCustomer?.billingMode === "AUTO_PILOT";

  // Initialize scheduler
  useScheduler();

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Billing
      </h1>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList>
          <TabsTrigger value="generate">Generate Invoice</TabsTrigger>
          <TabsTrigger value="history">Invoice History</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          {/* 1. Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Control Panel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="customerSelect">Customer</Label>
                  <Select
                    value={selectedCustomer?.id ?? ""}
                    onValueChange={handleCustomerSelect}
                  >
                    <SelectTrigger id="customerSelect">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billingMonth">Billing Month</Label>
                  <Input
                    id="billingMonth"
                    type="month"
                    value={formatMonth(billingMonth)}
                    onChange={(e) => handleMonthChange(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleFetchData}
                  disabled={!selectedCustomer || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    "Fetch Data"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Auto Pilot Info Banner */}
          {isAutoPilot && selectedCustomer?.schedule && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Auto Pilot Enabled</AlertTitle>
              <AlertDescription className="text-blue-700">
                This customer is on Auto Pilot. Invoices are generated automatically on day{" "}
                <strong>{selectedCustomer.schedule.dayOfMonth}</strong> at{" "}
                <strong>{selectedCustomer.schedule.time}</strong> for the previous calendar month.
                You can still generate a manual invoice below.
              </AlertDescription>
            </Alert>
          )}

          {/* 2. Service Cards */}
          {usageData.length > 0 && (
            <div className="space-y-4">
              {usageData.map((item) => (
                <ServiceCard
                  key={item.service}
                  item={item}
                  forceProvider={forceProviderCount[item.service]}
                  onForceProviderToggle={(checked) =>
                    handleForceProviderToggle(item.service, checked, item)
                  }
                  onBillableCountChange={(value) =>
                    handleBillableCountChange(item.service, value)
                  }
                />
              ))}
            </div>
          )}

          {/* 3. Footer Actions */}
          {usageData.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Grand Total</p>
                    <p className="text-3xl font-bold text-foreground">
                      RM {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleGenerateInvoice}
                    disabled={isGenerating || usageData.length === 0}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Generate Invoice
                      </>
                    )}
                  </Button>
                </div>
                {generateResult && (
                  <Alert className="mt-4" variant={generateResult.success ? "default" : "destructive"}>
                    {generateResult.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertTitle>{generateResult.success ? "Success" : "Error"}</AlertTitle>
                    <AlertDescription>{generateResult.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {usageData.length === 0 && !isLoading && (
            <div className="text-center py-16 text-muted-foreground">
              <p>Select a customer and billing month, then click &quot;Fetch Data&quot; to begin.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <InvoiceHistoryPanel />
        </TabsContent>

        <TabsContent value="schedules">
          <SchedulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Service Card Component ─── */

interface ServiceCardProps {
  item: UsageData;
  forceProvider: boolean;
  onForceProviderToggle: (checked: boolean) => void;
  onBillableCountChange: (value: string) => void;
}

function ServiceCard({
  item,
  forceProvider,
  onForceProviderToggle,
  onBillableCountChange,
}: ServiceCardProps): React.ReactElement {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Badge variant="outline">{item.service}</Badge>
          Service Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Section */}
        <div className={`grid grid-cols-1 ${item.hasProvider ? "md:grid-cols-2" : ""} gap-4`}>
          {/* Left: Reconciliation Data */}
          <div className="space-y-2 rounded-md border p-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Reconciliation Server
            </h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Sent</p>
                <p className="text-lg font-semibold">
                  {item.reconDetails.sent.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="text-lg font-semibold">
                  {item.reconDetails.failed.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Withheld</p>
                <p className="text-lg font-semibold">
                  {item.reconDetails.withheld.toLocaleString()}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Recon Total</span>
              <span className="font-semibold">
                {item.reconTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right: Provider Total (only when provider is configured) */}
          {item.hasProvider && (
            <div className="space-y-2 rounded-md border p-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Service Provider
              </h4>
              <div>
                <p className="text-muted-foreground text-sm">Total Count</p>
                <p className="text-3xl font-bold">
                  {item.providerTotal.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Logic/Alert Section */}
        {!item.hasProvider ? (
          <Alert className="border-muted bg-muted/30">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <AlertTitle>Recon Only</AlertTitle>
            <AlertDescription>
              No Service Provider configured. Billing based on Reconciliation Server count.
            </AlertDescription>
          </Alert>
        ) : !item.isMismatch ? (
          <Alert className="border-success/50 bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle className="text-success">Verified</AlertTitle>
            <AlertDescription>
              Counts matched. Discrepancy within limit.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Discrepancy Detected</AlertTitle>
            <AlertDescription>
              Alert: Provider count is higher than Recon by{" "}
              <strong>{item.discrepancyPercentage.toFixed(2)}%</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Billable Count Input */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="space-y-2 flex-1">
            <Label htmlFor={`billable-${item.service}`}>Billable Count</Label>
            <Input
              id={`billable-${item.service}`}
              type="number"
              min="0"
              value={item.billableCount}
              disabled={!item.hasProvider || !item.isMismatch || forceProvider}
              onChange={(e) => onBillableCountChange(e.target.value)}
            />
          </div>
          {item.hasProvider && item.isMismatch && (
            <div className="flex items-center space-x-2 pb-2">
              <Checkbox
                id={`force-${item.service}`}
                checked={forceProvider}
                onCheckedChange={(checked) =>
                  onForceProviderToggle(checked === true)
                }
              />
              <Label
                htmlFor={`force-${item.service}`}
                className="text-sm whitespace-nowrap"
              >
                Force use Provider Count
              </Label>
            </div>
          )}
        </div>

        <Separator />

        {/* Bottom Section: Rate & Total */}
        <div className="flex justify-between items-center">
          <div className="text-sm">
            <span className="text-muted-foreground">Rate: </span>
            <span className="font-medium">RM {item.rate.toFixed(4)}/unit</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Charge</p>
            <p className="text-xl font-bold">RM {item.totalCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Schedules Panel Component ─── */

function formatScheduleDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function formatBillingMonthLabel(billingMonth: string): string {
  const [year, month] = billingMonth.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getJobStatusBadge(status: ScheduleJobStatus): React.ReactElement {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "RUNNING":
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "RETRYING":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          <RotateCw className="h-3 w-3 mr-1" />
          Retrying
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="bg-rose-600 text-white hover:bg-rose-600">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function SchedulesPanel(): React.ReactElement {
  const jobs = useScheduleStore((s) => s.jobs);

  const upcomingJobs = useMemo(
    () =>
      jobs
        .filter((job) => job.status === "PENDING")
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [jobs]
  );

  const recentRuns = useMemo(
    () =>
      jobs
        .filter((job) => job.status !== "PENDING")
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [jobs]
  );

  return (
    <div className="space-y-6">
      {/* Upcoming Schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Upcoming Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No upcoming scheduled jobs. Enable Auto Pilot on a customer to create schedules.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Billing For</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.customerName}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatScheduleDate(job.scheduledAt)}
                      </TableCell>
                      <TableCell>{formatBillingMonthLabel(job.billingMonth)}</TableCell>
                      <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Recent Runs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No scheduled runs yet.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Ran At</TableHead>
                    <TableHead>Billing For</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Retries</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.customerName}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatScheduleDate(job.scheduledAt)}
                      </TableCell>
                      <TableCell>{formatBillingMonthLabel(job.billingMonth)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getJobStatusBadge(job.status)}
                          {job.error && (
                            <p className="text-xs text-rose-600 max-w-[200px] truncate" title={job.error}>
                              {job.error}
                            </p>
                          )}
                          {job.status === "RETRYING" && job.nextRetryAt && (
                            <p className="text-xs text-amber-600">
                              Next retry: {formatScheduleDate(job.nextRetryAt)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {job.retryCount}/{job.maxRetries}
                      </TableCell>
                      <TableCell className="text-right">
                        {job.status === "COMPLETED" && job.invoiceId && (
                          <Link href={`/history/${job.invoiceId}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Button>
                          </Link>
                        )}
                        {job.status === "FAILED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => alert(`Retrying job ${job.id}...`)}
                          >
                            <RotateCw className="h-4 w-4" />
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
